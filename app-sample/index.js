class SampleClass {
    constructor() {
    }

    method(args) {
        console.log(`SampleClass#method(${[ ...arguments ]})`);
    }
}

let time = 0;

setInterval(() => {
    new SampleClass().method(`time is passing: ${time}`);
    time += 1;
}, 1000);
