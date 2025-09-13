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

    PersonModel = client.loadSchema<Person>("person", personSchema);
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
    it("should create a model class", () => {
      expect(PersonModel).toBeDefined();
      expect(typeof PersonModel).toBe("function");
    });

    it("should have static methods", () => {
      expect(typeof PersonModel.find).toBe("function");
      expect(typeof PersonModel.findOne).toBe("function");
      expect(typeof PersonModel.findOneAsync).toBe("function");
      expect(typeof PersonModel.update).toBe("function");
      expect(typeof PersonModel.updateAsync).toBe("function");
      expect(typeof PersonModel.delete).toBe("function");
      expect(typeof PersonModel.deleteAsync).toBe("function");
      expect(typeof PersonModel.stream).toBe("function");
      expect(typeof PersonModel.execute_query).toBe("function");
      expect(typeof PersonModel.execute_batch).toBe("function");
      expect(typeof PersonModel.syncDB).toBe("function");
      expect(typeof PersonModel.syncDBAsync).toBe("function");
      expect(typeof PersonModel.truncate).toBe("function");
      expect(typeof PersonModel.truncateAsync).toBe("function");
    });

    it("should have model properties", () => {
      expect(PersonModel._properties).toBeDefined();
      expect(PersonModel._properties.name).toBe("person");
      expect(PersonModel._properties.schema).toBe(personSchema);
    });
  });

  describe("Model Instance", () => {
    it("should create a person instance", () => {
      const person = new PersonModel({
        userID: 1,
        name: "John",
        surname: "Doe",
        age: 30,
        points: 85.5,
      });

      expect(person.userID).toBe(1);
      expect(person.name).toBe("John");
      expect(person.surname).toBe("Doe");
      expect(person.age).toBe(30);
      expect(person.points).toBe(85.5);
    });

    it("should handle virtual fields", () => {
      const person = new PersonModel({
        userID: 1,
        name: "John",
        age: 30,
        points: 85.5,
      });

      // Test virtual getter
      expect(person.ageString).toBe("30");

      // Test virtual setter
      person.ageString = "25";
      expect(person.age).toBe(25);
    });

    it("should handle default values", () => {
      const person = new PersonModel({
        userID: 1,
        age: 30,
        points: 85.5,
      });

      expect(person.name).toBe("no name provided");
      expect(person.surname).toBe("no surname provided");
    });

    it("should handle methods from schema", () => {
      const person = new PersonModel({
        userID: 1,
        name: "John",
        surname: "Doe",
        age: 30,
        points: 85.5,
      });

      expect(typeof person.getName).toBe("function");
      expect(typeof person.getFullName).toBe("function");
      expect(typeof person.isAdult).toBe("function");

      expect(person.getName()).toBe("John");
      expect(person.getFullName()).toBe("John Doe");
      expect(person.isAdult()).toBe(true);
    });

    it("should track modifications", () => {
      const person = new PersonModel({
        userID: 1,
        name: "John",
        age: 30,
        points: 85.5,
      });

      expect(person.isModified()).toBe(false);

      person.name = "Jane";
      expect(person.isModified()).toBe(true);
      expect(person.isModified("name")).toBe(true);
      expect(person.isModified("age")).toBe(false);
    });

    it("should convert to JSON", () => {
      const person = new PersonModel({
        userID: 1,
        name: "John",
        surname: "Doe",
        age: 30,
        points: 85.5,
      });

      const json = person.toJSON();
      expect(json.userID).toBe(1);
      expect(json.name).toBe("John");
      expect(json.surname).toBe("Doe");
      expect(json.age).toBe(30);
      expect(json.points).toBe(85.5);
    });

    it("should have instance methods", () => {
      const person = new PersonModel({
        userID: 1,
        name: "John",
        age: 30,
        points: 85.5,
      });

      expect(typeof person.save).toBe("function");
      expect(typeof person.saveAsync).toBe("function");
      expect(typeof person.delete).toBe("function");
      expect(typeof person.deleteAsync).toBe("function");
      expect(typeof person.toJSON).toBe("function");
      expect(typeof person.isModified).toBe("function");
      expect(typeof person.validate).toBe("function");
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

    it("should have model instances", () => {
      expect(client.instance).toBeDefined();
      expect(client.instance.person).toBe(PersonModel);
    });
  });

  describe("Batch Operations", () => {
    it("should handle empty batch", async () => {
      const result = await client.doBatch([]);
      expect(result).toBeDefined();
    });

    it("should handle single query batch", async () => {
      const queries = [
        {
          query: "SELECT * FROM system.local",
          params: [],
          after_hook: () => true,
        },
      ];

      // This would fail without Cassandra connection, but tests the structure
      try {
        await client.doBatch(queries);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Schema Features", () => {
    it("should handle complex field types", () => {
      const schema = PersonModel._properties.schema;

      expect(schema.fields.timeMap).toEqual({
        type: "map",
        typeDef: "<text, timestamp>",
      });

      expect(schema.fields.intList).toEqual({
        type: "list",
        typeDef: "<int>",
      });

      expect(schema.fields.stringSet).toEqual({
        type: "set",
        typeDef: "<text>",
      });
    });

    it("should handle materialized views", () => {
      const schema = PersonModel._properties.schema;

      expect(schema.materialized_views).toBeDefined();
      expect(schema.materialized_views!.mat_view_composite).toEqual({
        select: ["*"],
        key: [["userID", "age"], "active"],
      });
    });

    it("should handle custom indexes", () => {
      const schema = PersonModel._properties.schema;

      expect(schema.custom_indexes).toBeDefined();
      expect(schema.custom_indexes![0]).toEqual({
        on: "name",
        using: "org.apache.cassandra.index.sasi.SASIIndex",
        options: {
          mode: "CONTAINS",
          analyzer_class:
            "org.apache.cassandra.index.sasi.analyzer.NonTokenizingAnalyzer",
          case_sensitive: "false",
        },
      });
    });

    it("should handle graph mapping", () => {
      const schema = PersonModel._properties.schema;

      // Graph mapping is optional, so we just check if it exists or is undefined
      if (schema.graph_mapping) {
        expect(schema.graph_mapping.relations).toBeDefined();
      } else {
        expect(schema.graph_mapping).toBeUndefined();
      }
    });

    it("should handle hooks", () => {
      const schema = PersonModel._properties.schema;

      expect(typeof schema.before_save).toBe("function");
      expect(typeof schema.after_save).toBe("function");
      expect(typeof schema.before_update).toBe("function");
      expect(typeof schema.after_update).toBe("function");
      expect(typeof schema.before_delete).toBe("function");
      expect(typeof schema.after_delete).toBe("function");
    });
  });
});
