#!/usr/bin/env bun

import { createClient } from "./src/index.js";

async function debugIssue1() {
  console.log("🔍 DEBUG ISSUE #1: Data Persistence Problem\n");

  const client = createClient({
    clientOptions: {
      contactPoints: ["127.0.0.1"],
      localDataCenter: "datacenter1",
      keyspace: "debug_issue1",
    },
    ormOptions: { createKeyspace: true },
  });

  try {
    await client.connect();
    console.log("✅ Connected");

    // Create test model like in failing tests
    const TestModel = await client.loadSchema("test_queries", {
      fields: {
        id: "uuid",
        category: "text",
        value: "int",
        tags: "set<text>",
        metadata: "map<text,text>",
        created_at: "timestamp",
      },
      key: ["id"],
    });
    console.log("✅ Schema loaded");

    // Insert data like in failing test
    const testData = {
      id: client.constructor.uuid(),
      category: "A",
      value: 10,
      tags: new Set(["tag1", "tag2"]),
      metadata: new Map([["key1", "value1"]]),
      created_at: new Date("2024-01-01"),
    };

    console.log("🔄 Inserting data...");
    await TestModel.create(testData);
    console.log("✅ Data inserted");

    // Try to find immediately
    console.log("🔄 Finding data immediately...");
    const results1 = await TestModel.find({ category: "A" });
    console.log(`Results immediately: ${results1.length}`);

    // Wait and try again
    console.log("🔄 Waiting 500ms...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const results2 = await TestModel.find({ category: "A" });
    console.log(`Results after wait: ${results2.length}`);

    // Try find all
    const allResults = await TestModel.find({});
    console.log(`All results: ${allResults.length}`);

    // Try count
    const count = await TestModel.count();
    console.log(`Count: ${count}`);

    // Try direct query
    const directResults = await client.execute(
      "SELECT * FROM test_queries WHERE category = ?",
      ["A"],
    );
    console.log(`Direct query results: ${directResults.rows?.length || 0}`);

    await client.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

debugIssue1();

process.exit(0);
