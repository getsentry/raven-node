// sentry.interfaces.Query

module.exports = function(query, engine) {
    return {
        query: query,
        engine: engine
    };
};
