// @cassandraorm
import { createEnhancedClient } from "cassandraorm-js";
const client = createEnhancedClient({
    clientOptions: {
        contactPoints: ["127.0.0.1"],
        localDataCenter: "datacenter1",
        keyspace: "myapp",
    },
    aiml: {
        openai: {
            apiKey: process.env.OPENAI_API_KEY,
            model: "text-embedding-3-small",
        },
        semanticCache: {
            enabled: true,
            threshold: 0.85,
        },
    },
});
const UserSchema = {
    fields: {
        id: {
            type: "uuid",
            validate: { required: true },
        },
        name: {
            type: "text",
            validate: { required: true, minLength: 2 },
        },
        email: {
            type: "text",
            validate: { required: true, isEmail: true },
        },
        created_at: {
            type: "timestamp",
            default: () => new Date(),
        },
    },
    key: ["id"],
    clustering_order: { created_at: "desc" },
};
async function example() {
    await client.connect();
    const User = await client.loadSchema("users", UserSchema);
    // AI/ML operations
    const embedding = await client.generateEmbedding("search text");
    const similar = await client.vectorSimilaritySearch(embedding, 0.8);
    // Distributed locking
    await client.withDistributedLock("user-update", async () => {
        const user = await User.save({
            name: "John Doe",
            email: "john@example.com",
        });
        console.log("User created:", user);
    });
    // CQL query
    const result = await client.execute(`
    SELECT * FROM users
    WHERE active = ?
    AND created_at > ?
  `, [true, new Date("2024-01-01")]);
    await client.shutdown();
}
