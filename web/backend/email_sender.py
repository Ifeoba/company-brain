from .config import settings


def send_expert_question_email(
    to_email: str,
    to_name: str,
    asker_name: str,
    brain_name: str,
    question_text: str,
    context_text: str,
    expert_link: str,
) -> None:
    if not settings.resend_api_key:
        # Dev mode — log to console
        print(f"\n[EMAIL — dev mode, no RESEND_API_KEY set]")
        print(f"  To: {to_name} <{to_email}>")
        print(f"  Subject: Quick question from {asker_name} — {brain_name}")
        print(f"  Link: {expert_link}\n")
        return

    import resend
    resend.api_key = settings.resend_api_key

    context_block = ""
    if context_text:
        context_block = f"<blockquote style='border-left:3px solid #e5e5e5;margin:16px 0;padding:0 16px;color:#666'>{context_text}</blockquote>"

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:40px auto;color:#111;line-height:1.6">
  <p>Hi {to_name},</p>
  <p><strong>{asker_name}</strong> is building an AI brain to handle <strong>{brain_name}</strong> and wants your help with one quick question — because you're the person who knows this best.</p>
  {context_block}
  <div style="background:#f8f8f8;border:1px solid #e5e5e5;border-radius:4px;padding:16px 20px;margin:20px 0">
    <p style="margin:0;font-weight:600">The question:</p>
    <p style="margin:8px 0 0">{question_text}</p>
  </div>
  <p><a href="{expert_link}" style="display:inline-block;background:#7cf29c;color:#111;font-weight:600;padding:10px 20px;border-radius:4px;text-decoration:none">Answer this question →</a></p>
  <p style="color:#666;font-size:14px">No login required. Your answer goes back to {asker_name} and helps encode how the work actually happens.</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0">
  <p style="color:#999;font-size:12px">— Company Brain</p>
</body>
</html>
"""

    text = f"""Hi {to_name},

{asker_name} is building an AI brain to handle {brain_name} and wants your help with one quick question.

{('Context: ' + context_text + chr(10) + chr(10)) if context_text else ''}The question:

{question_text}

Click here to answer (no login required):
{expert_link}

Your answer goes back to {asker_name} and helps encode how the work actually happens.

— Company Brain
"""

    resend.Emails.send({
        "from": settings.resend_from_email,
        "to": to_email,
        "subject": f"Quick question from {asker_name} — {brain_name}",
        "html": html,
        "text": text,
    })
