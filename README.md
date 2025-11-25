# Simple bounding box labelling tool

Whilst curating a dataset for my BSc thesis for finetuning Qwen 2.5 VL for image analysis tasks with grounding,
I found myself with the problem of not having a good solution labelling effectively.
None of the preexisting labelling tools supported my use case out of the box, so I quickly built this webapp, specifically for my needs.

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

Image of the tool in use:

![bbox](https://github.com/user-attachments/assets/fb1efe80-7630-416c-9b50-4796d3bfa0f8)
