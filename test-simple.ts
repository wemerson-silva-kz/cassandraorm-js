// @cassandraorm
import { createEnhancedClient } from "cassandraorm-js";

console.log("🚀 Starting CassandraORM test...");

try {
  const client = createEnhancedClient({
    clientOptions: {
      contactPoints: ["127.0.0.1"],
      localDataCenter: "datacenter1",
      keyspace: "myapp",
    },
    aiml: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || "test-key",
        model: "text-embedding-3-small",
      },
      semanticCache: {
        enabled: true,
        threshold: 0.85,
      },
    },
  });

  console.log("✅ Client created successfully!");
  console.log("Client type:", typeof client);
  console.log("Client methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(client)));

} catch (error) {
  console.error("❌ Error:", error);
}

console.log("🎉 Test completed!");
