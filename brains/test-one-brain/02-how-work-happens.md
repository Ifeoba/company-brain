# How the Work Happens

<!--
INSTRUCTIONS: Describe how this work actually happens today — not how it's supposed to
happen per the SOP, but how the person who does it actually does it.

The best source for this file is a direct interview or observation session with that person.
If you're writing this without talking to them, mark every section as [UNVERIFIED] and go
back to check.

Don't write the happy path only. Note where things go sideways and what happens then.
-->

## Trigger

<!-- What kicks this work off? Be specific.
     Example: "A new support ticket arrives in the Zendesk 'Billing' queue with no assignee." -->


## Inputs

<!-- What data or materials does the person start with?
     List each input, its format, and where it comes from.
     Example:
     - Ticket text (plain text, from Zendesk)
     - Customer email address (from the ticket)
     - Customer's billing status (queried from Stripe via customer email) -->


## Steps

<!-- Walk through the work from trigger to completion.
     Be specific enough that a new hire could follow this and get it right.
     Include: what's done at each step, what system is used, what the output of each step is.

     Example:
     1. Open the ticket in Zendesk.
     2. Check the customer's billing status in Stripe using their email.
        - If status is "active": proceed to step 3.
        - If status is "cancelled": see "Cancelled account handling" below.
     3. ... -->


## Completion

<!-- What does "done" look like? How does the person know the work is finished?
     Example: "Draft is in the Zendesk reply box, flagged for supervisor review.
     The ticket status is changed to 'Pending'." -->


## Common variations

<!-- What are the main ways this work differs from the standard flow?
     Don't list every possible edge case — just the variations that come up regularly.
     Example:
     - Ticket is in a language other than English → route to human immediately
     - Customer has an open dispute → do not draft; flag for billing team
     - Ticket arrives outside business hours → draft still, but mark with [AFTER-HOURS] tag -->


## What can go wrong

<!-- What breaks, goes sideways, or requires manual intervention?
     Example:
     - Stripe is down → cannot verify billing status → hold ticket until Stripe is back
     - Customer email not found in Stripe → escalate immediately, do not guess -->


## Source

<!-- Who did you interview or observe to write this? When?
     Example: "Priya Mehta (AR analyst), interviewed 2025-04-10. Reviewed by Priya 2025-04-12." -->
