;; CassandraORM Schema Grammar for Zed

;; Schema definition
(object
  (pair
    key: (property_identifier) @keyword.schema
    (#match? @keyword.schema "^(fields|key|clustering_order|relations|validate)$")))

;; Field types
(string
  (string_fragment) @type.cassandra
  (#match? @type.cassandra "^(text|varchar|ascii|int|bigint|smallint|tinyint|float|double|decimal|boolean|uuid|timeuuid|timestamp|date|time|blob|inet|counter|set|list|map|frozen)"))

;; Validation keywords
(property_identifier) @keyword.validation
(#match? @keyword.validation "^(required|minLength|maxLength|min|max|isEmail|isUrl|pattern)$")

;; CassandraORM methods
(call_expression
  function: (member_expression
    property: (property_identifier) @function.cassandra
    (#match? @function.cassandra "^(find|findOne|save|update|delete|execute|generateEmbedding|optimizeQueryWithAI|withDistributedLock|loadSchema|connect|shutdown)$")))

;; AI/ML methods
(call_expression
  function: (member_expression
    property: (property_identifier) @function.ai
    (#match? @function.ai "^(generateEmbedding|optimizeQueryWithAI|vectorSimilaritySearch|getPerformanceReport|getSemanticCacheStats)$")))

;; Distributed methods
(call_expression
  function: (member_expression
    property: (property_identifier) @function.distributed
    (#match? @function.distributed "^(withDistributedLock|acquireDistributedLock|releaseDistributedLock|discoverServices|setDistributedConfig|getDistributedConfig|getSystemHealth)$")))

;; CQL queries
(template_string) @string.cql
(#match? @string.cql "^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)")

;; Comments
(comment) @comment

;; Strings
(string) @string
(template_string) @string

;; Numbers
(number) @number

;; Booleans
(true) @boolean
(false) @boolean

;; Keywords
(const) @keyword
(let) @keyword
(var) @keyword
(function) @keyword
(async) @keyword
(await) @keyword
(import) @keyword
(export) @keyword
(from) @keyword

;; Operators
"=" @operator
"=>" @operator
"." @operator
"?" @operator
":" @operator

;; Punctuation
"(" @punctuation.bracket
")" @punctuation.bracket
"[" @punctuation.bracket
"]" @punctuation.bracket
"{" @punctuation.bracket
"}" @punctuation.bracket
"," @punctuation.delimiter
";" @punctuation.delimiter
