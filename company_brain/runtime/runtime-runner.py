{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import json\
import uuid\
from datetime import datetime\
from pathlib import Path\
\
\
RUNTIME_DIR = Path("./Runtime")\
\
\
# ----------------------------\
# Helpers\
# ----------------------------\
\
def load_json(file_name):\
    path = RUNTIME_DIR / file_name\
    with open(path, "r") as f:\
        return json.load(f)\
\
\
def save_jsonl(path, record):\
    with open(path, "a") as f:\
        f.write(json.dumps(record) + "\\n")\
\
\
def now():\
    return datetime.utcnow().isoformat()\
\
\
# ----------------------------\
# Load Runtime Configuration\
# ----------------------------\
\
company_profile = load_json("CompanyProfile.json")\
capabilities = load_json("Capabilities.json")\
tool_mapping = load_json("toolmapping.json")\
skills = load_json("SkillContracts.json")\
policies = load_json("ExecutionPolicy.json")\
runtime_config = load_json("RuntimeConfig.json")\
event_schema = load_json("EventSchema.json")\
\
EVENT_LOG = RUNTIME_DIR / "runtime-events.jsonl"\
\
\
# ----------------------------\
# Core Engine\
# ----------------------------\
\
class RuntimeRunner:\
\
    def __init__(self):\
        self.company = company_profile\
        self.skills = skills["skills"]\
        self.capabilities = capabilities["capabilities"]\
        self.tool_mapping = tool_mapping["tool_mapping"]\
        self.policies = policies["policies"]\
\
    # ------------------------\
    # Event Entry Point\
    # ------------------------\
    def run_event(self, event):\
        event_id = str(uuid.uuid4())\
\
        print("\\n==============================")\
        print(f"EVENT RECEIVED: \{event\}")\
        print("==============================\\n")\
\
        matched_skills = self.match_skill(event)\
\
        if not matched_skills:\
            print("No matching skill found.")\
            return\
\
        for skill in matched_skills:\
            self.execute_skill(skill, event, event_id)\
\
    # ------------------------\
    # Skill Matching\
    # ------------------------\
    def match_skill(self, event):\
        matched = []\
\
        for skill in self.skills:\
            trigger = skill.get("trigger", \{\})\
\
            if trigger.get("event_type") == event.get("event_type"):\
\
                conditions = trigger.get("conditions", \{\})\
\
                # simple condition check (MVP)\
                match = True\
                for key, value in conditions.items():\
                    if key in event and event[key] not in value if isinstance(value, list) else event[key] != value:\
                        match = False\
                        break\
\
                if match:\
                    matched.append(skill)\
\
        return matched\
\
    # ------------------------\
    # Execution Engine\
    # ------------------------\
    def execute_skill(self, skill, event, event_id):\
\
        print(f"\\n--- Executing Skill: \{skill['id']\} ---")\
\
        policy_id = skill.get("execution_policy", "default-linear")\
        policy = self.get_policy(policy_id)\
\
        log_entry = \{\
            "event_id": event_id,\
            "skill_id": skill["id"],\
            "timestamp": now(),\
            "status": "started",\
            "steps": []\
        \}\
\
        result_context = \{"input": event\}\
\
        # ------------------------\
        # Execute Steps\
        # ------------------------\
        steps = policy.get("steps", [])\
\
        for step in steps:\
\
            step_result = self.execute_step(step, result_context)\
\
            log_entry["steps"].append(step_result)\
\
            # stop on failure (MVP rule)\
            if step_result["status"] == "failed":\
                log_entry["status"] = "failed"\
                self.log_event(log_entry)\
                return\
\
            # merge outputs into context\
            result_context[step["id"]] = step_result.get("output")\
\
        log_entry["status"] = "completed"\
        self.log_event(log_entry)\
\
    # ------------------------\
    # Step Execution\
    # ------------------------\
    def execute_step(self, step, context):\
\
        step_id = step["id"]\
        capability = step.get("capability")\
\
        print(f"Running step: \{step_id\} (\{capability\})")\
\
        # resolve tool\
        tool = self.resolve_tool(capability)\
\
        if not tool:\
            return \{\
                "step": step_id,\
                "status": "failed",\
                "error": f"No tool mapped for capability \{capability\}"\
            \}\
\
        # simulate execution (MVP)\
        output = self.simulate_tool_call(capability, context)\
\
        return \{\
            "step": step_id,\
            "status": "completed",\
            "capability": capability,\
            "tool": tool,\
            "output": output,\
            "timestamp": now()\
        \}\
\
    # ------------------------\
    # Tool Resolution\
    # ------------------------\
    def resolve_tool(self, capability):\
        return self.tool_mapping.get(capability)\
\
    # ------------------------\
    # Simulated Execution Layer\
    # ------------------------\
    def simulate_tool_call(self, capability, context):\
\
        # NO domain assumptions \'97 generic simulation layer\
        return \{\
            "capability_executed": capability,\
            "simulated": True,\
            "context_keys": list(context.keys()),\
            "message": f"Executed \{capability\} successfully (simulated)"\
        \}\
\
    # ------------------------\
    # Policy Loader\
    # ------------------------\
    def get_policy(self, policy_id):\
\
        for policy in self.policies:\
            if policy["policy_id"] == policy_id:\
                return policy\
\
        return \{"policy_id": "default", "steps": []\}\
\
    # ------------------------\
    # Logging\
    # ------------------------\
    def log_event(self, log_entry):\
        save_jsonl(EVENT_LOG, log_entry)\
        print("\\n\uc0\u55357 \u56550  Logged Event:")\
        print(json.dumps(log_entry, indent=2))\
\
\
# ----------------------------\
# Manual Runner (MVP INPUT)\
# ----------------------------\
\
if __name__ == "__main__":\
\
    runner = RuntimeRunner()\
\
    print("\\n\uc0\u55357 \u56960  Company Brain Runtime MVP Started")\
    print("Enter events as JSON (or 'exit')\\n")\
\
    while True:\
        user_input = input("Event > ")\
\
        if user_input.lower() == "exit":\
            break\
\
        try:\
            event = json.loads(user_input)\
            runner.run_event(event)\
\
        except Exception as e:\
            print(f"Invalid input: \{e\}")}