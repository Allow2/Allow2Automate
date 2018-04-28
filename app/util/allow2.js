import request from 'request';

const apiUrl = 'https:/api.allow2.com';

const allow2Login = function(params, onError, onSuccess) {
    request({
        url: apiUrl + '/login',
        method: 'POST',
        json: true,
        body: {
            email: params.email,
            pass: params.pass
        }
    }, function (error, response, body) {
        if (error) {
            console.log('error:', error);
            return onError(error, response, body);
        }
        if (!response) {
            console.log('Invalid Response');
            return onError(error, response, body);
        }
        if (!response.statusCode || (response.statusCode != 200)) {
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            return onError(error, response, body)
        }
        console.log('body:', body);
        onSuccess(body);
    });
};

const allow2Request = function(path, params, onError, onSuccess) {
    request({
        url: apiUrl + path,
        method: 'POST',
        json: true,
        ...params
    }, function (error, response, body) {
        if (error) {
            console.log('error:', error);
            return onError(error, response, body);
        }
        if (!response) {
            console.log('Invalid Response');
            return onError(error, response, body);
        }
        if (!response.statusCode || (response.statusCode != 200)) {
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            return onError(error, response, body);
        }
        //console.log('body:', body);
        onSuccess(body);
    });
};

module.exports = {
    allow2Login,
    allow2Request
};