import { beforeAll, describe, expect, it } from "bun:test";
import { type Person, personSchema } from "../src/examples/person.js";
import { CassandraClient, createClient, timeuuid, uuid } from "../src/index.js";

describe("CassandraClient", () => {
  let client: CassandraClient;
  let PersonModel: any;

  beforeAll(async () => {
    client = createClient({
      clientOptions: {
        contactPoints: ["127.0.0.1"],
        localDataCenter: "datacenter1",
        keyspace: "test_keyspace",
      },
      ormOptions: {
        defaultReplicationStrategy: {
          class: "SimpleStrategy",
          replication_factor: 1,
        },
        migration: "safe",
      },
    });

    // Await the Promise returned by loadSchema
    PersonModel = await client.loadSchema<Person>("person", personSchema);
  });

  describe("Client Creation", () => {
    it("should create a client instance", () => {
      expect(client).toBeInstanceOf(CassandraClient);
    });

    it("should have UUID utilities", () => {
      expect(typeof client.uuid).toBe("function");
      expect(typeof client.timeuuid).toBe("function");
      expect(typeof client.uuidFromString).toBe("function");
    });

    it("should have static UUID utilities", () => {
      expect(typeof uuid).toBe("function");
      expect(typeof timeuuid).toBe("function");
    });

    it("should generate valid UUIDs", () => {
      const id = uuid();
      expect(id).toBeDefined();
      expect(id.toString()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should generate valid TimeUUIDs", () => {
      const timeId = timeuuid();
      expect(timeId).toBeDefined();
      expect(timeId.toString()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe("Model Creation", () => {
    it("should create a model object", () => {
      expect(PersonModel).toBeDefined();
      expect(typeof PersonModel).toBe("function");
    });

    it("should have static methods", () => {
      expect(typeof PersonModel.find).toBe("function");
      expect(typeof PersonModel.findOne).toBe("function");
      expect(typeof PersonModel.findOneAsync).toBe("function");
    });

    it("should have model properties", () => {
      expect(PersonModel._properties).toBeDefined();
      expect(PersonModel._properties.name).toBe("person");
      expect(PersonModel._properties.schema).toBe(personSchema);
    });
  });

  describe("Client Properties", () => {
    it("should have consistency levels", () => {
      expect(client.consistencies).toBeDefined();
    });

    it("should have data types", () => {
      expect(client.datatypes).toBeDefined();
    });

    it("should have driver access", () => {
      expect(client.driver).toBeDefined();
    });
  });

  describe("Batch Operations", () => {
    it("should handle batch queries", () => {
      expect(client.driver).toBeDefined();
      expect(typeof client.driver.batch).toBe("function");
    });
  });

  describe("Schema Features", () => {
    it("should handle schema properties", () => {
      const schema = PersonModel._properties.schema;
      expect(schema).toBeDefined();
      expect(schema.fields).toBeDefined();
      expect(schema.key).toBeDefined();
    });
  });
});
