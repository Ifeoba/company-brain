# Interview Questions

Questions for each of the six validation dimensions, used in interview mode.

For each dimension: ask the [Open] questions first and listen. Use [Probe] questions only when the answer is vague, surface-level, or suspiciously clean. You are trying to reach a defensible score — pick the questions that get you there, not all of them.

---

## Dimension 1: Service Definition

### [Open]
- "Describe the specific service you're building a brain for. What triggers the work, what's the unit, and what does done look like?"
- "Who does this work today, and what does their day look like when they're doing it?"
- "What is explicitly NOT part of this service — what would someone expect it to cover that it doesn't?"

### [Probe — use if the service sounds broad or fuzzy]
- "You said '[their description]' — if I gave you three requests from the same queue, could you tell me in 10 seconds whether each one is in scope? Walk me through one."
- "What's the smallest unit of work someone could hand you, and you'd come back with a finished output? Not a project — one item."
- "Does a human currently get paid to do exactly this? What's their title? How long does one unit take them?"
- "What's the first thing that could come in that you'd say 'that's not what this brain is for'?"

### [Probe — use if scope boundary is missing]
- "Give me two examples of things that look like this work but aren't — things that would end up in the same inbox but your brain shouldn't touch."
- "If the agent got a request that was 80% like the core service but with an important difference, what would that difference be?"

---

## Dimension 2: Knowledge Layer

### [Open]
- "How did you learn how this work actually gets done? Walk me through your research process."
- "What's something about how this service runs that surprised you — something you didn't know before you dug in?"
- "What do the people doing this work know that isn't written down anywhere?"

### [Probe — use if the answer sounds like a paraphrase of a document]
- "You mentioned [thing they said]. Where did that come from — did you read it somewhere or did someone tell you?"
- "Who did you interview, when, and for how long? What were the most unexpected things they said?"
- "Is there a specific customer, partner, or vendor that gets handled differently from everyone else? What's the rule for them, and where is it written?"

### [Probe — use if the knowledge seems too clean]
- "What goes wrong with this service? Not rarely — what goes wrong regularly? How do people handle it?"
- "What's a rule that everyone who does this job knows but that you'd never find in the official process doc?"
- "If the person who currently does this went on holiday tomorrow and someone new had to cover, what would they get wrong in the first week?"

### [Probe — use if sources are unclear]
- "For any given rule in your brain, can you tell me where it came from? If I challenged it, what would you point to?"
- "Has anyone who actually does this work read what you've written and confirmed it's accurate?"

---

## Dimension 3: Judgment Layer

### [Open]
- "How does the agent know what to do when the situation doesn't fit the obvious pattern? Walk me through a decision it would need to make."
- "What are the cases where the right answer isn't obvious — where a smart new hire would probably get it wrong?"
- "Do you have an eval set? Tell me about the hardest case in it."

### [Probe — use if decision rules seem thin or obvious-only]
- "Tell me a case where the agent would look at the input and the answer isn't clear. What does it do?"
- "What's the most dangerous mistake the agent could make? Is there a rule in the brain that prevents it?"
- "You mentioned [thing they said]. What happens if [edge condition]? Is that written down?"

### [Probe — use if eval set seems too easy]
- "How many cases are in the eval set, and how many of them are 'hard' — meaning a smart new hire would probably get it wrong?"
- "What's the case in your eval set where the wrong answer is most tempting? What makes it tempting?"
- "Pull up your hardest eval case and read it to me. Why is it hard?"

### [Probe — use if escalation logic is vague]
- "When does the agent escalate? Give me a specific trigger condition — not 'when unsure', but a concrete situation."
- "When it escalates, who does it go to, in what format, and what information does that person receive? Is that written in the brain?"
- "How does the agent know it has approval to proceed after an escalation?"

---

## Dimension 4: Skills / Action Layer

### [Open]
- "What does the agent actually do? Not what it knows — what does it execute? Walk me through the actions step by step."
- "For each step in the workflow, is there a defined skill with named inputs and outputs?"
- "Could a developer implement the agent's skills from what you've written, without asking you any questions?"

### [Probe — use if skills seem described rather than specified]
- "Take one skill and tell me: what triggers it, what are the inputs with their types, what are the outputs with their types, and what system does it touch?"
- "What abstract capabilities does this skill need — things like `send_message`, `lookup_record`, `write_record`? Are those written down?"
- "Which skills require human approval before they execute? Is that written in the brain?"

### [Probe — use if the action layer seems thin]
- "Is there any step in the workflow that the agent would need to take but doesn't have a defined skill for?"
- "The agent makes a decision. Then what happens? What does it actually do with that decision?"
- "If I gave you the skill definitions today, could I build a working agent by next week? What's missing?"

---

## Dimension 5: Guardrails

### [Open]
- "What can't the agent do — what would be catastrophic if it did it without asking? Is that written down?"
- "Walk me through the three categories: what the agent decides alone, what it escalates, and what it never does."
- "Is there anything in your guardrails file right now that's in the agent's head but not in any artifact it reads?"

### [Probe — use if guardrails seem vague]
- "You said the agent [shouldn't do X]. Where in your materials is that written? If I removed you from the picture, would the agent still know that?"
- "Give me the most dangerous thing this agent could do if no one was watching. Is there a hard constraint in the brain that prevents it?"
- "For your 'escalates to human' items: who exactly does it escalate to, in what format, and what information does that person receive? Is that level of detail written?"

### [Probe — use if the skills/guardrails mapping seems incomplete]
- "Go through each skill in your skills file. For each one, tell me which guardrail category it falls into: agent decides alone, escalates, or never does."
- "Is there any skill that you're not sure which category it belongs to? That uncertainty is worth resolving before the agent runs."

### [Probe — use if "never does" items have exceptions]
- "You said the agent never does [X] — is there any situation where it would? If yes, that's not a 'never does' constraint, it's an escalation condition."

---

## Dimension 6: Proof

### [Open]
- "Has the agent done a real unit of work yet — real input, real output, someone checked it? Tell me about it."
- "Who verified the output, and what was their verdict?"
- "What went wrong in the proof run, and what did you do about it?"

### [Probe — use if the proof sounds like a demo]
- "Was the input real company data, or did you construct an example for the test?"
- "Did the agent complete the work end-to-end, or did a human finish it?"
- "Who signed off — was it you, or someone who didn't build the brain?"

### [Probe — use if only easy cases were tested]
- "Did the proof run include any edge or hard cases, or just the standard scenario?"
- "Did anything in the proof run surprise you — an outcome the brain got wrong, or a case you hadn't anticipated?"
- "What would you need to see in a proof run to feel confident the agent is ready for real use?"

### [Probe — if no proof exists yet]
- "What's stopping you from running a proof? What would the first real test look like?"
- "Who would you need to sign off on the output for it to count as verified?"
- "What's the smallest real piece of work you could run the agent on this week?"
