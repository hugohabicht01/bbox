# Simple bounding box labelling tool

Whilst curating a dataset for my BSc thesis for finetuning Qwen 2.5 VL for image analysis tasks with grounding,
I found myself with the problem of not having a good solution labelling effectively.
None of the preexisting labelling tools supported my use case out of the box, so I quickly built this with the help of Claude Sonnet 3.5 and o3-mini-high.

The initial setup was done by Claude, resizing + deletion of boxes was implemented by o3 (after i ran out of free messages from claude lol).
It has now become my test repo for experimenting/wasting credits with Claude Code. The agentic abilities are quite impressive, but funnily enough it has massive problems with <output> tags and constantly wants to replace them with <o>. Not sure where that obsession is coming from...
After that I added the text box parsing + two way text binding, a task that both models failed horribly at.

The basic premise is to be able to load, edit and save the custom bounding boxes annotation format.

An example of an annotation a single image looks as follows:

```
<think>
I can see a person walking on the street, his face is visible.
On the street there are some cars with number plates visible
(this is the section where the model is supposed to dump its thoughts in a standard Chain of Thought way)
</think>

<output>
[
    {
        "label": "face",
        "description": "a face of a person walking down the street",
        "explanation": "a persons faces is a unique attribute that can be used to identify them",
        "bounding_box": [374, 171, 424, 227],
        "severity": 7
    },
    {
        "label": "license_plate",
        "description": "a license plate on a car",
        "explanation": "a license plate is a unique string that can be used to identify the owner of the car",
        "bounding_box": [342, 345, 402, 350],
        "severity": 5
    }
]
</output>
```
