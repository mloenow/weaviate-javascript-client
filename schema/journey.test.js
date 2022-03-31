const weaviate = require("../index");

describe("schema", () => {
  const client = weaviate.client({
    scheme: "http",
    host: "localhost:8080",
  });

  const classObj = {
    class: 'MyThingClass',
    properties: [
      {
        dataType: ["string"],
        name: 'stringProp',
        tokenization: "word",
        moduleConfig: {
          'text2vec-contextionary': {
            skip: false,
            vectorizePropertyName: false
          }
        }
      }
    ],
    vectorIndexType: 'hnsw',
    vectorizer: 'text2vec-contextionary',
    vectorIndexConfig: {
      cleanupIntervalSeconds: 300,
      dynamicEfFactor: 8,
      dynamicEfMax: 500,
      dynamicEfMin: 100,
      ef: -1,
      maxConnections: 64,
      skip: false,
      efConstruction: 128,
      vectorCacheMaxObjects: 500000,
      flatSearchCutoff: 40000
    },
    invertedIndexConfig: {
      cleanupIntervalSeconds: 60,
      bm25: {
        b: 0.75,
        k1: 1.2
      },
      stopwords: {
        preset: "en",
        additions: null,
        removals: null
      }
    },
    moduleConfig: {
      'text2vec-contextionary':
      {
        vectorizeClassName: true
      }
    },
    shardingConfig: {
      actualCount: 1,
      actualVirtualCount: 128,
      desiredCount: 1,
      desiredVirtualCount: 128,
      function: "murmur3",
      key: "_id",
      strategy: "hash",
      virtualPerPhysical: 128,
    },
  };

  it("creates a thing class (implicitly)", () => {
    return client.schema
      .classCreator()
      .withClass(classObj)
      .do()
      .then((res) => {
        expect(res).toEqual(classObj);
      });
  });

  it("gets an existing class", () => {
    return client.schema
      .classGetter()
      .withClassName(classObj.class)
      .do()
      .then((res) => {
        expect(res).toEqual(classObj);
      });
  });

  it("extends the thing class with a new property", () => {
    const className = "MyThingClass";
    const prop = {
      dataType: ["string"],
      name: "anotherProp",
      tokenization: "word",
      moduleConfig: {
        'text2vec-contextionary': {
          skip: false,
          vectorizePropertyName: false
        }
      }
    };

    return client.schema
      .propertyCreator()
      .withClassName(className)
      .withProperty(prop)
      .do()
      .then((res) => {
        expect(res).toEqual(prop);
      });
  });

  it("retrieves the schema and it matches the expectations", () => {
    return client.schema
      .getter()
      .do()
      .then((res) => {
        expect(res).toEqual({
          classes: [
            {
              class: "MyThingClass",
              properties: [
                {
                  dataType: ["string"],
                  name: "stringProp",
                  tokenization: "word",
                  moduleConfig: {
                    'text2vec-contextionary': {
                      skip: false,
                      vectorizePropertyName: false
                    }
                  }
                },
                {
                  dataType: ["string"],
                  name: "anotherProp",
                  tokenization: "word",
                  moduleConfig: {
                    'text2vec-contextionary': {
                      skip: false,
                      vectorizePropertyName: false
                    }
                  }
                },
              ],
              vectorIndexType: "hnsw",
              vectorizer: "text2vec-contextionary",
              vectorIndexConfig: {
                cleanupIntervalSeconds: 300,
                dynamicEfFactor: 8,
                dynamicEfMax: 500,
                dynamicEfMin: 100,
                ef: -1,
                maxConnections: 64,
                skip: false,
                efConstruction: 128,
                vectorCacheMaxObjects: 500000,
                flatSearchCutoff: 40000
              },
              invertedIndexConfig: {
                cleanupIntervalSeconds: 60,
                bm25: {
                  b: 0.75,
                  k1: 1.2
                },
                stopwords: {
                  preset: "en",
                  additions: null,
                  removals: null
                }
              },
              moduleConfig: { 
                'text2vec-contextionary': 
                { 
                  vectorizeClassName: true
                }
              },
              shardingConfig: {
                actualCount: 1,
                actualVirtualCount: 128,
                desiredCount: 1,
                desiredVirtualCount: 128,
                function: "murmur3",
                key: "_id",
                strategy: "hash",
                virtualPerPhysical: 128,
              },
            },
          ],
        });
      });
  });

  it("gets the shards of an existing class", () => {
    return client.schema
      .shardsGetter()
      .withClassName(classObj.class)
      .do()
      .then((res) => {
        res.forEach(shard => {
          expect(shard.status).toEqual("READY");
        });
      });
  })

  it("updates a shard of an existing class to readonly", async () => {
    var shards = await getShards(client, classObj.class);
    expect(Array.isArray(shards)).toBe(true)
    expect(shards.length).toEqual(1)

    client.schema
      .shardUpdater()
      .withClassName(classObj.class)
      .withShardName(shards[0].name)
      .withStatus("READONLY")
      .do()
      .then(res => {
        expect(res.status).toEqual("READONLY");
    });
  })

  it("updates a shard of an existing class to ready", async () => {
    var shards = await getShards(client, classObj.class);
    expect(Array.isArray(shards)).toBe(true)
    expect(shards.length).toEqual(1)

    client.schema
      .shardUpdater()
      .withClassName(classObj.class)
      .withShardName(shards[0].name)
      .withStatus("READY")
      .do()
      .then(res => {
        expect(res.status).toEqual("READY");
    });
  })

  it("updates all shards in a class to READONLY", async () => {
    var shardCount = 3
    var readonlyClass = classObj
    readonlyClass.class = "ReadonlyClass"
    readonlyClass.shardingConfig.desiredCount = shardCount

    await client.schema
      .classCreator()
      .withClass(classObj)
      .do()
      .then((res) => {
        expect(res).toHaveProperty('shardingConfig.actualCount', 3)
      });

    var shards = await getShards(client, readonlyClass.class);
    expect(Array.isArray(shards)).toBe(true)
    expect(shards.length).toEqual(shardCount)

    return client.schema
      .shardsUpdater()
      .withClassName(classObj.class)
      .withStatus("READONLY")
      .do()
      .then(res => {
        expect(res.length).toEqual(shardCount)
        res.forEach(obj => {
          expect(obj.status).toEqual("READONLY")
        });
      });
  })

  it("updates all shards in a class to READY", async () => {
    var shardCount = 3
    var readyClass = classObj
    readyClass.class = "ReadyClass"
    readyClass.shardingConfig.desiredCount = shardCount

    await client.schema
      .classCreator()
      .withClass(classObj)
      .do()
      .then((res) => {
        expect(res).toHaveProperty('shardingConfig.actualCount', 3)
      });

    var shards = await getShards(client, readyClass.class);
    expect(Array.isArray(shards)).toBe(true)
    expect(shards.length).toEqual(shardCount)

    return client.schema
      .shardsUpdater()
      .withClassName(classObj.class)
      .withStatus("READY")
      .do()
      .then(res => {
        expect(res.length).toEqual(shardCount)
        res.forEach(obj => {
          expect(obj.status).toEqual("READY")
        });
      });
  })

  it("deletes an existing class", () => {
    const className = "MyThingClass";

    return client.schema
      .classDeleter()
      .withClassName(className)
      .do()
      .then((res) => {
        expect(res).toEqual(undefined);
      });
  });
});

async function getShards(client, className) {
  return client.schema
    .shardsGetter()
    .withClassName(className)
    .do()
    .then((res) => {
      return res;
    });
}
