# Simple bounding box labelling tool

Whilst curating a dataset for my BSc thesis for finetuning Qwen 2.5 VL for image analysis tasks with grounding,
I found myself with the problem of not having a good solution labelling effectively.
None of the preexisting labelling tools supported my use case out of the box, so I quickly built this with the help of Claude Sonnet 3.5 and o3-mini-high.

The initial setup was done by Claude, resizing + deletion of boxes was implemented by o3 (after i ran out of free messages from claude lol).
After that I added the text box parsing + two way text binding, a task that both models failed horribly at.
