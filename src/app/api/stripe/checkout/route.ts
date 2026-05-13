import Stripe from "stripe";

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

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    return Response.json(
      { error: "Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
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

  if (!sessionId) {
    return Response.json({ error: "sessionId is required." }, { status: 400 });
  }
  if (!email) {
    return Response.json({ error: "email is required." }, { status: 400 });
  }

  const userId = getUserIdFromSessionId(sessionId);
  const stripe = new Stripe(secretKey);
  const origin = publicOrigin(req);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?upgrade=success`,
    cancel_url: `${origin}/?upgrade=cancelled`,
    metadata: { userId }
  });

  if (!session.url) {
    return Response.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 500 }
    );
  }

  return Response.json({ url: session.url });
}
