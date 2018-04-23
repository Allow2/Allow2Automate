// Modal process
const modal = require('electron-modal');

document.getElementById('#increment').addEventListener('click', () => {
    modal.emit('increment').then(() => {
        console.log('The increment event was sent');
    });
});

document.getElementById('#decrement').addEventListener('click', () => {
    modal.emit('decrement').then(() => {
        console.log('The decrement event was sent');
    });
});

modal.getData().then((data) => {

    // Apply the data you passed to the modal
    document.querySelector('h1').innerHTML = data.title;

    // And once we're ready, let's show it!
    modal.show();

});