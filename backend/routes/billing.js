const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_ID = process.env.STRIPE_PRICE_ID;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://galineo.vercel.app';

// POST /billing/checkout — crée une session Stripe Checkout
router.post('/checkout', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  db.get('SELECT email, stripe_customer_id, plan FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.plan === 'premium') return res.status(400).json({ error: 'Déjà abonné Premium' });

    try {
      let customerId = user.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, metadata: { userId: String(userId) } });
        customerId = customer.id;
        db.run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, userId]);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: PRICE_ID, quantity: 1 }],
        mode: 'payment',
        success_url: `${FRONTEND_URL}/settings?billing=success`,
        cancel_url: `${FRONTEND_URL}/settings?billing=cancelled`,
        metadata: { userId: String(userId) }
      });

      res.json({ url: session.url });
    } catch (e) {
      console.error('[billing/checkout]', e.message);
      res.status(500).json({ error: e.message });
    }
  });
});

// POST /billing/portal — portail Stripe pour gérer/annuler
router.post('/portal', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  db.get('SELECT stripe_customer_id FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err || !user || !user.stripe_customer_id) {
      return res.status(400).json({ error: 'Aucun abonnement actif' });
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: `${FRONTEND_URL}/settings`
      });
      res.json({ url: session.url });
    } catch (e) {
      console.error('[billing/portal]', e.message);
      res.status(500).json({ error: e.message });
    }
  });
});

// GET /billing/status — plan actuel de l'utilisateur
router.get('/status', authMiddleware, (req, res) => {
  db.get('SELECT plan, ai_prompts_count FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Introuvable' });
    res.json({ plan: user.plan || 'free', ai_prompts_count: user.ai_prompts_count || 0 });
  });
});

// POST /billing/webhook — événements Stripe (raw body requis)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('[webhook] Signature invalide:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    if (userId) {
      db.run(
        'UPDATE users SET plan = ?, stripe_subscription_id = ? WHERE id = ?',
        ['premium', session.subscription || session.payment_intent, userId]
      );
      console.log(`✅ [billing] User ${userId} passé en Premium`);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    db.run(
      'UPDATE users SET plan = ?, stripe_subscription_id = NULL WHERE stripe_subscription_id = ?',
      ['free', sub.id]
    );
    console.log(`⬇️ [billing] Abonnement ${sub.id} annulé → free`);
  }

  res.json({ received: true });
});

module.exports = router;
