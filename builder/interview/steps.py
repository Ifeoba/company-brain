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
    json_files: list[str] = field(default_factory=list)


STEPS: list[Step] = [
    Step(
        number=1,
        name="What this is",
        files=["01-service-definition.md"],
        questions=[
            Question(
                key="process_name",
                text="What's the name of the process or job this is about?\n"
                     "(e.g. invoice approvals, customer onboarding, expense categorisation)",
            ),
            Question(
                key="trigger",
                text="What usually kicks this off?\n"
                     "(e.g. an email arrives, a customer signs up, someone submits a form)",
            ),
            Question(
                key="done_looks_like",
                text="What does a completed piece of this work look like?\n"
                     "How do you know when it's done?",
            ),
            Question(
                key="who_does_it",
                text="Who handles this today? What's their job title?",
            ),
            Question(
                key="time_taken",
                text="Roughly how long does one piece of this work take them?",
            ),
            Question(
                key="tools_used",
                text="What tools or apps do they use to get it done?\n"
                     "(e.g. email, spreadsheets, Salesforce, a WhatsApp group -- anything goes)",
            ),
            Question(
                key="out_of_scope",
                text="What does this NOT include?\n"
                     "Name 2 things that seem related but won't be covered here.",
            ),
        ],
    ),
    Step(
        number=2,
        name="How it works",
        files=["02-how-work-happens.md", "02-unwritten-rules.md"],
        questions=[
            Question(
                key="workflow",
                text="Walk me through the steps from start to finish.\n"
                     "How does this work actually get done, in plain language?",
            ),
            Question(
                key="common_problems",
                text="What's the most common thing that goes wrong or causes delays?",
            ),
            Question(
                key="second_problem",
                text="What's the second most common issue?\n"
                     "(There's always more than one -- take your time.)",
            ),
            Question(
                key="unwritten_rules",
                text="What would a brand new person get wrong in their first week\n"
                     "that an experienced person would never get wrong?",
            ),
            Question(
                key="more_unwritten_rules",
                text="Any other things that aren't written down anywhere but matter a lot?\n"
                     "(These are gold -- don't hold back)",
            ),
            Question(
                key="special_cases",
                text="Are there any customers, partners, or situations\n"
                     "that get treated differently from the norm?\n"
                     "Describe them.",
            ),
            Question(
                key="source",
                text="Who did you talk to to understand how this works?\n"
                     "(Name and job title is enough)",
            ),
        ],
    ),
    Step(
        number=3,
        name="Making decisions",
        files=["03-decision-rules.md"],
        json_files=["03-evals.json"],
        questions=[
            Question(
                key="routine_case",
                text="Describe a typical, straightforward case.\n"
                     "What comes in, and what's the obvious right thing to do?",
            ),
            Question(
                key="tricky_case",
                text="Describe a case that looks normal at first\n"
                     "but actually needs more careful handling.\n"
                     "What makes it different?",
            ),
            Question(
                key="hard_case",
                text="Describe a case where even an experienced person might pause and think.\n"
                     "What's the situation, and what does a good decision look like?",
            ),
            Question(
                key="decision_rules",
                text="Are there any rules of thumb the person doing this job relies on?\n"
                     "(e.g. if the amount is over 500, always check with the manager first)",
            ),
            Question(
                key="escalation_trigger",
                text="When should a person step in instead of letting this run automatically?\n"
                     "What's the signal that something needs human eyes?",
            ),
            Question(
                key="escalation_who",
                text="When it needs to be escalated, who gets notified?\n"
                     "And how -- email, Slack, a phone call?",
            ),
        ],
    ),
    Step(
        number=4,
        name="What it does",
        files=["04-skills.md"],
        questions=[
            Question(
                key="actions",
                text="What are the main tasks this process actually carries out?\n"
                     "List them simply -- things like: look up account info, send a confirmation email, update a record.",
            ),
            Question(
                key="info_needed",
                text="What information does it need to get started?\n"
                     "Where does that information come from?",
            ),
            Question(
                key="what_it_produces",
                text="What does it produce or change when it's done?\n"
                     "(e.g. a filled-in spreadsheet row, an email sent to the customer, a status updated in the system)",
            ),
            Question(
                key="connected_systems",
                text="Which apps or systems does this connect to?\n"
                     "(e.g. Gmail, Slack, your CRM, a database, WhatsApp -- list them all)",
            ),
            Question(
                key="read_write",
                text="For each system you just listed:\n"
                     "does this process read from it, write to it, or both?",
            ),
            Question(
                key="approval_required",
                text="Are there any tasks that need a person to give the green light\n"
                     "before they happen? Which ones, and who approves?",
            ),
        ],
    ),
    Step(
        number=5,
        name="Limits and boundaries",
        files=["05-guardrails.md"],
        questions=[
            Question(
                key="fully_automatic",
                text="What kinds of decisions can be handled completely automatically,\n"
                     "without anyone needing to check?\n"
                     "Be as specific as you can -- the more detail the better.",
            ),
            Question(
                key="needs_approval",
                text="What kinds of decisions need a person to weigh in before anything happens?\n"
                     "Who is that person?",
            ),
            Question(
                key="approval_how",
                text="How does that approval happen in practice?\n"
                     "(e.g. they reply to an email, they click approve in Slack, they call me)",
            ),
            Question(
                key="never_does",
                text="What should this absolutely never do, no matter what?\n"
                     "Think about what would cause a serious problem -- or make the news.",
            ),
            Question(
                key="data_limits",
                text="Are there any types of data or information\n"
                     "that this should never touch or share?\n"
                     "(e.g. personal data, financial records, confidential client information)",
            ),
        ],
    ),
    Step(
        number=6,
        name="Testing it out",
        files=["06-proof-log.md"],
        questions=[
            Question(
                key="proof_work",
                text="Has this been tested on a real example yet, using real information?\n"
                     "If yes -- describe the example: what came in, what happened, what was produced.\n"
                     "If not yet, just type: not yet.",
            ),
            Question(
                key="verifier",
                text="Who checked the result?\n"
                     "(Name and job title -- must be someone other than the person who set this up)",
            ),
            Question(
                key="verdict",
                text="Did it pass?\n"
                     "If corrections were needed, what was wrong and what was changed?",
            ),
        ],
    ),
]
