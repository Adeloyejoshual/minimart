router.post('/subscribe-plan', async (req, res) => {
  try {
    const { amount, email, metadata } = req.body;
    
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount, // already in kobo
        callback_url: `${window.location.origin}/payment-success`,
        metadata: {
          plan: metadata.plan_name,
          duration: metadata.duration
        }
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});