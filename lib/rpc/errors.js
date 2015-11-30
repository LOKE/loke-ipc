// see: http://www.jsonrpc.org/specification#error_object

exports.PARSE_ERROR = -32700; // Parse error - Invalid JSON was received by the server. // An error occurred on the server while parsing the JSON text.
exports.INVALID_REQUEST = -32600; // Invalid Request. The JSON sent is not a valid Request object.
exports.METHOD_NOT_FOUND = -32601; // Method not found	The method does not exist / is not available.
exports.INVALID_PARAMS = -32602; // Invalid params. Invalid method parameter(s).
exports.INTERNAL_ERROR = -32603; // Internal error. Internal JSON-RPC error.
exports.SERVER_BASE_ERROR = -32000; // to -32099. Server error. Reserved for implementation-defined server-errors.
