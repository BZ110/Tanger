"""Small JSON Schema validator for the repository-generated source profile."""

import re


def validate(schema, value, location="profile", root=None):
    root = root or schema
    if "$ref" in schema:
        definition = root
        for token in schema["$ref"].removeprefix("#/").split("/"):
            definition = definition[token.replace("~1", "/").replace("~0", "~")]
        return validate(definition, value, location, root)
    if "anyOf" in schema:
        for choice in schema["anyOf"]:
            try:
                validate(choice, value, location, root)
                return
            except ValueError:
                pass
        raise ValueError(location + ": no allowed type matches")
    kind = schema.get("type")
    types = {
        "object": dict,
        "array": list,
        "string": str,
        "number": (int, float),
        "integer": int,
        "boolean": bool,
        "null": type(None),
    }
    if kind and (
        not isinstance(value, types[kind])
        or (kind in ["number", "integer"] and isinstance(value, bool))
    ):
        raise ValueError(location + ": wrong type")
    if "const" in schema and value != schema["const"]:
        raise ValueError(location + ": unexpected constant")
    if "enum" in schema and value not in schema["enum"]:
        raise ValueError(location + ": value not in enum")
    if kind in ["number", "integer"]:
        import math

        if not math.isfinite(value):
            raise ValueError(location + ": expected finite number")
        if value < schema.get("minimum", -math.inf) or value > schema.get(
            "maximum", math.inf
        ):
            raise ValueError(location + ": out of range")
    if kind == "string":
        if len(value) < schema.get("minLength", 0):
            raise ValueError(location + ": empty value")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            raise ValueError(location + ": does not match pattern")
        if value.startswith("/") or ".." in value.split("/"):
            if "path" in location.lower() or "mask" in location.lower():
                raise ValueError(location + ": use repository-relative paths")
    if kind == "array":
        if len(value) < schema.get("minItems", 0) or len(value) > schema.get(
            "maxItems", float("inf")
        ):
            raise ValueError(location + ": array size out of range")
        for i, item in enumerate(value):
            specs = schema.get("prefixItems", [])
            spec = specs[i] if i < len(specs) else schema.get("items", {})
            if spec is False:
                raise ValueError(location + ": tuple too long")
            if isinstance(spec, dict):
                validate(spec, item, location + f"[{i}]", root)
    if kind == "object":
        for key in schema.get("required", []):
            if key not in value:
                definition = schema.get("properties", {}).get(key, {})
                if "default" in definition:
                    value[key] = __import__("copy").deepcopy(definition["default"])
                else:
                    raise ValueError(location + "." + key + ": required")
        for key, item in value.items():
            spec = schema.get("properties", {}).get(key)
            if spec is None and schema.get("additionalProperties") is False:
                raise ValueError(location + "." + key + ": unknown field")
            if spec:
                validate(spec, item, location + "." + key, root)
