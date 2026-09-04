const fetch = require('node-fetch');

(async () => {
  const res = await fetch("http://localhost:5000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "t2", email: "t2@x.com", password: "p12" })
  });
  const data = await res.json();
  const token = data.token;
  console.log("Got token", !!token);

  const res2 = await fetch("http://localhost:5000/api/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [{ role: "user", content: "Hi" }],
      stream: true
    })
  });
  console.log("Chat response status:", res2.status);
  const text = await res2.text();
  console.log(text.slice(0, 100));
})();
