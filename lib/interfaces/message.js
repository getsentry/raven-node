// sentry.interfaces.Message

module.exports = function(msg) {
    return {
        message: msg,
        params: []
    };
};

module.exports.key = 'sentry.interfaces.Message';
