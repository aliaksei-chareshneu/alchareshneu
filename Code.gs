function doPost(e) {
    const payload = JSON.parse(e.postData.contents).data;
    const msg = "🚀 New Booking: " + (payload.event_name || payload.service) + "\n👤 Name: " + payload.name;
    UrlFetchApp.fetch("https://api.telegram.org/botYOUR_TOKEN/sendMessage", {
        method: "post",
        payload: { chat_id: "YOUR_ID", text: msg, parse_mode: "HTML" }
    });
    return ContentService.createTextOutput(JSON.stringify({status: "ok"})).setMimeType(ContentService.MimeType.JSON);
}