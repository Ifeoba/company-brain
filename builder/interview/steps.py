from dataclasses import dataclass, field


@dataclass
class Question:
    key: str
    text: str


@dataclass
class Step:
    number: int
    name: str
    files: list[str]
    questions: list[Question]
    json_files: list[str] = field(default_factory=list)  # files requiring JSON output


STEPS: list[Step] = [
    Step(
        number=1,
        name="Service Definition",
        files=["01-service-definition.md"],
        questions=[
            Question(
                key="service_description",
                text="What service are we building a brain for?\n"
                     "Describe the trigger (what starts the work), the unit (one piece of work),\n"
                     "and what done looks like — in one or two sentences.",
            ),
            Question(
                key="who_does_it",
                text="Who does this today? What's their role, and roughly how long does\n"
                     "one unit of work take them?",
            ),
            Question(
                key="systems",
                text="What systems, tools, or data sources does this work touch?\n"
                     "(e.g. Slack, HubSpot, a specific spreadsheet, a database table)",
            ),
            Question(
                key="out_of_scope",
                text="What is explicitly NOT in scope — things that seem related but\n"
                     "this brain won't handle? Give at least two examples.",
            ),
        ],
    ),
    Step(
        number=2,
        name="Knowledge Layer",
        files=["02-how-work-happens.md", "02-unwritten-rules.md"],
        questions=[
            Question(
                key="workflow",
                text="Walk me through how the work actually happens, step by step.\n"
                     "What triggers it, what's the sequence, and when is it complete?",
            ),
            Question(
                key="failure_modes",
                text="What goes wrong? Name the most common failure modes,\n"
                     "edge cases, or things that slow the work down.",
            ),
            Question(
                key="unwritten_rules",
                text="What does the person doing this job know that isn't written down anywhere?\n"
                     "Give me 3–5 unwritten rules — things a new hire would get wrong in their first week.",
            ),
            Question(
                key="special_cases",
                text="Are there specific customers, partners, vendors, or situations\n"
                     "that get handled differently from everyone else? Describe the exceptions.",
            ),
            Question(
                key="source",
                text="Who did you interview or consult to learn how this work happens?\n"
                     "(Name, role, and date if you have it)",
            ),
        ],
    ),
    Step(
        number=3,
        name="Judgment Layer",
        files=["03-decision-rules.md"],
        json_files=["03-evals.json"],
        questions=[
            Question(
                key="decision_rules",
                text="What decisions does the agent need to make?\n"
                     "Describe 2–3 situations and the right call in each — in IF/THEN terms if possible.",
            ),
            Question(
                key="edge_cases",
                text="What are the edge cases — situations that look routine but have a\n"
                     "non-obvious correct answer? What makes each one a trap?",
            ),
            Question(
                key="escalation",
                text="When should the agent stop and ask a human?\n"
                     "What's the trigger, who does it escalate to, and what information do they need?",
            ),
            Question(
                key="eval_cases",
                text="Give me 3 test cases:\n"
                     "  1. A routine case (obvious correct answer)\n"
                     "  2. An edge case (unusual but has a clear rule)\n"
                     "  3. A hard case (non-obvious; a smart person would likely get it wrong)\n"
                     "For each: what's the input, and what should the agent decide?",
            ),
        ],
    ),
    Step(
        number=4,
        name="Skills",
        files=["04-skills.md"],
        questions=[
            Question(
                key="actions",
                text="What does the agent actually DO — not decide, but execute?\n"
                     "List the 3–6 core actions (look things up, send messages, write records, queue tasks, etc.)",
            ),
            Question(
                key="inputs_outputs",
                text="For each action you listed: what input does it need, and what does it produce?\n"
                     "Be specific — name the data types and where they come from.",
            ),
            Question(
                key="integrations",
                text="What external systems does the agent need to connect to?\n"
                     "For each: does it read from it, write to it, or both — and via what method?\n"
                     "(e.g. Slack — sends escalation messages via webhook;\n"
                     " Postgres — reads transactions table, writes category_assignments;\n"
                     " Gmail — sends confirmation emails via SMTP;\n"
                     " Microsoft Teams — posts approval requests to a channel)",
            ),
            Question(
                key="approval_required",
                text="Which of these actions require a human to approve before the agent can proceed?\n"
                     "For those: who approves, in what format, and what does approval look like?",
            ),
        ],
    ),
    Step(
        number=5,
        name="Guardrails",
        files=["05-guardrails.md"],
        questions=[
            Question(
                key="agent_decides",
                text="What can the agent decide and act on entirely alone, without asking anyone?\n"
                     "Be precise about the conditions — not 'low-value transactions' but\n"
                     "'transactions under £50 with a matching PO on file'.",
            ),
            Question(
                key="escalates",
                text="What must the agent ask a human before doing?\n"
                     "For each: who does it ask, how (Slack/email/ticket), what info does the human need,\n"
                     "and what does approval look like?",
            ),
            Question(
                key="never_does",
                text="What must the agent NEVER do, under any circumstances — no exceptions?\n"
                     "Think: what's the worst thing it could do? What would make the news?",
            ),
        ],
    ),
    Step(
        number=6,
        name="Proof",
        files=["06-proof-log.md"],
        questions=[
            Question(
                key="proof_work",
                text="Has the agent completed a real unit of work yet using real company data?\n"
                     "If yes: describe the input, what the agent did step by step, and what it produced.\n"
                     "If not yet, type 'not yet' and we'll leave the proof log as a template to fill in later.",
            ),
            Question(
                key="verifier",
                text="Who verified the output? (Name, role, date)\n"
                     "This must be someone other than the brain builder.",
            ),
            Question(
                key="verdict",
                text="What was their verdict — pass, fail, or pass with corrections?\n"
                     "If corrections were needed, what was wrong and how was it fixed?",
            ),
        ],
    ),
]
