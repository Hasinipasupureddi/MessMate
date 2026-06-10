(async()=>{
  try{
    const res = await fetch('http://localhost:4028/api/auth/signup',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email:'signup.test.user@messmate.local', password:'TestPass@123', name:'Signup Test', role:'student', hostelId:'A'})
    });
    const text = await res.text();
    console.log('status', res.status);
    console.log(text);
  }catch(e){console.error(e)}
})();
