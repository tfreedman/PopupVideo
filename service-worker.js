browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "hi") {
    sendResponse({ message: "hello!" });
  }
});
