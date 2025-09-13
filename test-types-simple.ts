import { createClient, CassandraClientOptions } from "./dist/index.js";

const options: CassandraClientOptions = {
  clientOptions: {
    contactPoints: ["127.0.0.1"],
    localDataCenter: "datacenter1",
    keyspace: "test"
  }
};

const client = createClient(options);
console.log("Types working!");
