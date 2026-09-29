const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests',timeout:45000,workers:4,retries:0,reporter:[['list'],['html',{open:'never'}]],use:{baseURL:'http://127.0.0.1:8000',browserName:'chromium',screenshot:'only-on-failure',trace:'retain-on-failure'},webServer:{command:'python3 -m http.server 8000',port:8000,reuseExistingServer:!process.env.CI}});
