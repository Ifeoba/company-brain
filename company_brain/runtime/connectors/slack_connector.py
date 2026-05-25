from company_brain.runtime.connectors.base_connector import BaseConnector


class SlackConnector(BaseConnector):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    def send(self, message: str):
        print(f"[Slack] Sending: {message}")

    def receive(self):
        print("[Slack] Listening for events...")
