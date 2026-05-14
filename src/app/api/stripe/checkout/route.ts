import Stripe from "stripe";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Loose but practical email shape check (catches most Stripe "invalid email" / pattern issues). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STRIPE_PRICE_ID_PATTERN = /^price_[a-zA-Z0-9]+$/;

function describeSessionId(sessionId: string): {
  length: number;
  segmentCount: number;
  looksLikeJwt: boolean;
  looksLikeUuid: boolean;
} {
  const segments = sessionId.split(".");
  return {
    length: sessionId.length,
    segmentCount: segments.length,
    looksLikeJwt: segments.length === 3 && segments.every((s) => s.length > 0),
    looksLikeUuid: UUID_PATTERN.test(sessionId)
  };
}

function getUserIdFromSessionId(sessionId: string): string {
  const parts = sessionId.split(".");
  if (parts.length >= 2) {
    try {
      const json = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload = JSON.parse(json) as { sub?: string };
      if (typeof payload.sub === "string" && payload.sub.length > 0) {
        return payload.sub;
      }
    } catch {
      // fall through — treat whole value as stable id (e.g. UUID)
    }
  }
  return sessionId;
}

function publicOrigin(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_URL?.replace(/\/$/, "") ??
    new URL(req.url).origin
  );
}

function jsonError(
  status: number,
  message: string,
  details?: Record<string, unknown>
) {
  return Response.json({ error: message, ...details }, { status });
}

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    return jsonError(
      500,
      "Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID."
    );
  }

  if (!STRIPE_PRICE_ID_PATTERN.test(priceId)) {
    console.error("[checkout] STRIPE_PRICE_ID failed pattern check", {
      priceIdPrefix: priceId.slice(0, 12),
      expectedPattern: String(STRIPE_PRICE_ID_PATTERN)
    });
    return jsonError(
      500,
      "STRIPE_PRICE_ID must look like a Stripe Price id (e.g. price_xxx).",
      {
        validation: "STRIPE_PRICE_ID",
        pattern: STRIPE_PRICE_ID_PATTERN.source
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (parseErr) {
    console.error("[checkout] Invalid JSON body", parseErr);
    return jsonError(400, "Invalid JSON body.");
  }

  const sessionId =
    typeof body === "object" &&
    body !== null &&
    "sessionId" in body &&
    typeof (body as { sessionId: unknown }).sessionId === "string"
      ? (body as { sessionId: string }).sessionId.trim()
      : "";

  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof (body as { email: unknown }).email === "string"
      ? (body as { email: string }).email.trim()
      : "";

  console.log("[checkout] received sessionId:", sessionId);
  console.log("[checkout] sessionId shape:", describeSessionId(sessionId));

  if (!sessionId) {
    return jsonError(400, "sessionId is required.");
  }

  if (!email) {
    return jsonError(400, "email is required.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    console.warn("[checkout] email failed pattern validation", {
      emailLength: email.length,
      pattern: EMAIL_PATTERN.source
    });
    return jsonError(400, "email failed pattern validation.", {
      validation: "email",
      pattern: EMAIL_PATTERN.source
    });
  }

  const origin = publicOrigin(req);
  let successUrl: string;
  let cancelUrl: string;
  try {
    successUrl = new URL("/?upgrade=success", origin).href;
    cancelUrl = new URL("/?upgrade=cancelled", origin).href;
  } catch (urlErr) {
    console.error("[checkout] Invalid public origin / URL build failed", {
      origin,
      urlErr
    });
    return jsonError(
      500,
      "Invalid NEXT_PUBLIC_URL or request origin; could not build success/cancel URLs.",
      { validation: "origin", origin }
    );
  }

  const userId = getUserIdFromSessionId(sessionId);
  console.log("[checkout] resolved metadata userId:", userId);

  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId }
    });

    if (!session.url) {
      console.error("[checkout] Stripe session created but url is empty", {
        sessionIdStripe: session.id
      });
      return jsonError(
        500,
        "Stripe did not return a checkout URL."
      );
    }

    return Response.json({ url: session.url });
  } catch (err: unknown) {
    if (err instanceof Stripe.errors.StripeError) {
      console.error("[checkout] Stripe API error", {
        type: err.type,
        code: err.code,
        param: err.param,
        message: err.message,
        statusCode: err.statusCode,
        requestId: err.requestId,
        doc_url: err.doc_url
      });

      const status =
        typeof err.statusCode === "number" && err.statusCode >= 400
          ? err.statusCode
          : 502;

      return jsonError(
        status >= 400 && status < 600 ? status : 502,
        err.message || "Stripe checkout failed.",
        {
          stripe: {
            type: err.type,
            code: err.code,
            param: err.param,
            requestId: err.requestId,
            doc_url: err.doc_url
          }
        }
      );
    }

    console.error("[checkout] Unexpected error", err);
    return jsonError(
      500,
      err instanceof Error ? err.message : "Unexpected server error."
    );
  }
}
