/**
 * Stop the in-memory MongoDB instance and disconnect from mongoose
 */
module.exports = async () => {
    console.log("Stopping mongo server");
    const mongoServer = global.__MONGOSERVER__;
    await mongoServer.stop();
};
