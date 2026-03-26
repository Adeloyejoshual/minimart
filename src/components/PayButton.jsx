export default function PayButton({ email, amount }) {
  const handlePayment = async () => {
    const res = await fetch("/api/paystack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount }),
    });
    const data = await res.json();
    console.log(data); // contains authorization URL
    window.location.href = data.data.authorization_url; // redirect user to Paystack checkout
  };

  return <button onClick={handlePayment}>Pay Now</button>;
}