// sentry.interfaces.Message

module.exports = function(msg) {
    return {
        message: msg,
        params: []
    };
};

module.exports.name = 'sentry.interfaces.Message';
