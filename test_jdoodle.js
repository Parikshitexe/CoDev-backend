fetch('http://localhost:3000/api/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'print("hello from jdoodle")', language: 'python' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
