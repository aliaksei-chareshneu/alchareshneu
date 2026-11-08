
(function(){
  "use strict";
  var ENDPOINT="https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-digital-store";
  var currentPrices={csv_rescue:490,ai_roi:690};
  var status=document.getElementById("shop-status");
  var error=document.getElementById("shop-error");
  var buttons=Array.from(document.querySelectorAll("[data-digital-product]"));
  function showStatus(value){if(status)status.textContent=value;}
  function showError(value){if(error)error.textContent=value;}
  async function initialize(){
    buttons.forEach(function(btn){btn.disabled=true;btn.textContent="Checkout not active";});
    showStatus("Checking payment availability...");
    try{
      var response=await fetch(ENDPOINT+"/health",{method:"GET",cache:"no-store",credentials:"omit"});
      if(!response.ok)throw Error("Not available");
      var data=await response.json();
      var active=0;
      (data.products||[]).forEach(function(product){
        if(currentPrices[product.product_key]!==product.price_czk)return;
        buttons.filter(function(btn){return btn.dataset.digitalProduct===product.product_key;}).forEach(function(btn){
          if(product.checkout_active){btn.disabled=false;btn.textContent="Pay securely and download";active++;}
        });
      });
      if(active===0)showStatus("Checkout is temporarily closed pending business/tax verification. No payment can be taken.");
      else showStatus("Secure digital checkout is available. The file is released after confirmed payment.");
    }catch(e){showStatus("Checkout is currently unavailable. No payment can be taken.");}
  }
  buttons.forEach(function(btn){btn.addEventListener("click",async function(){
    if(btn.disabled)return;
    showError("");
    var terms=document.getElementById("agree-terms"), immediate=document.getElementById("agree-immediate");
    if(!terms||!immediate||!terms.checked||!immediate.checked){
      showError("Please actively agree to the terms and request immediate digital delivery first.");
      if(terms&&!terms.checked)terms.focus();else if(immediate)immediate.focus();
      return;
    }
    btn.disabled=true;btn.textContent="Connecting to secure checkout...";
    try{
      var response=await fetch(ENDPOINT+"/checkout-intent",{
        method:"POST",mode:"cors",credentials:"omit",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({product_key:btn.dataset.digitalProduct,accepted_terms:true,immediate_delivery_requested:true,policy_version:"digital-v1-20261108"})
      });
      var data=await response.json();
      if(!response.ok||typeof data.checkout_url!=="string"||!data.checkout_url.startsWith("https://buy.stripe.com/"))
        throw Error("Checkout remains closed. You have not been charged.");
      window.location.assign(data.checkout_url);
    }catch(e){showError(e.message||"Checkout is unavailable. You have not been charged.");btn.disabled=false;btn.textContent="Try secure checkout again";}
  });});
  initialize();
})();
