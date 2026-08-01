#!/usr/bin/env python3
"""Generate a source-derived Supabase contract for the Skilled Crafting app.

This scanner is intentionally conservative. It records only literal relation,
RPC, bucket, and column references visible in the deployed source. It does not
attempt to infer data types or rewrite database objects.
"""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_VERSION = "2026-07-25-steps6-14-v1"

JS_EXTENSIONS = {".js", ".jsx"}


def relpath(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def resolve_local_import(base: Path, specifier: str) -> Path | None:
    if not specifier.startswith("."):
        return None
    target = base.parent / specifier
    candidates = [
        target,
        target.with_suffix(".js"),
        target.with_suffix(".jsx"),
        target.with_suffix(".css"),
        target.with_suffix(".json"),
        target / "index.js",
        target / "index.jsx",
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()
    return None


def active_frontend_files() -> set[Path]:
    all_files = {
        path.resolve(): path
        for path in (ROOT / "src").rglob("*")
        if path.is_file() and path.suffix in JS_EXTENSIONS | {".css", ".json"}
    }
    import_pattern = re.compile(
        r"(?:import\s+(?:[^'\"]+?\s+from\s+)?|import\s*\(|export\s+[^'\"]*?\s+from\s+)['\"]([^'\"]+)['\"]"
    )
    graph: dict[Path, list[Path]] = {}
    for absolute, path in all_files.items():
        if path.suffix not in JS_EXTENSIONS:
            graph[absolute] = []
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        dependencies: list[Path] = []
        for match in import_pattern.finditer(text):
            resolved = resolve_local_import(path, match.group(1))
            if resolved is not None:
                dependencies.append(resolved)
        graph[absolute] = dependencies

    entry = (ROOT / "src" / "main.jsx").resolve()
    stack = [entry]
    seen: set[Path] = set()
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        stack.extend(graph.get(current, []))

    return {
        path
        for path in seen
        if path in all_files and all_files[path].suffix in JS_EXTENSIONS
    }


def scan_to_statement_end(text: str, start: int, max_chars: int = 8000) -> str:
    """Return the current JS statement, respecting strings and nesting."""
    end_limit = min(len(text), start + max_chars)
    paren = bracket = brace = 0
    quote: str | None = None
    escaped = False
    index = start
    while index < end_limit:
        char = text[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            index += 1
            continue
        if char in {"'", '"', "`"}:
            quote = char
        elif char == "(":
            paren += 1
        elif char == ")":
            paren = max(0, paren - 1)
        elif char == "[":
            bracket += 1
        elif char == "]":
            bracket = max(0, bracket - 1)
        elif char == "{":
            brace += 1
        elif char == "}":
            brace = max(0, brace - 1)
        elif char == ";" and paren == 0 and bracket == 0 and brace == 0:
            return text[start : index + 1]
        index += 1
    return text[start:end_limit]


def split_top_level(value: str, delimiter: str = ",") -> list[str]:
    parts: list[str] = []
    start = 0
    paren = bracket = brace = 0
    quote: str | None = None
    escaped = False
    for index, char in enumerate(value):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in {"'", '"', "`"}:
            quote = char
        elif char == "(":
            paren += 1
        elif char == ")":
            paren = max(0, paren - 1)
        elif char == "[":
            bracket += 1
        elif char == "]":
            bracket = max(0, bracket - 1)
        elif char == "{":
            brace += 1
        elif char == "}":
            brace = max(0, brace - 1)
        elif char == delimiter and paren == 0 and bracket == 0 and brace == 0:
            parts.append(value[start:index].strip())
            start = index + 1
    parts.append(value[start:].strip())
    return [part for part in parts if part]


def string_call_arguments(statement: str, method_name: str) -> list[str]:
    pattern = re.compile(rf"\.{re.escape(method_name)}\(\s*([`'\"])", re.S)
    values: list[str] = []
    for match in pattern.finditer(statement):
        quote = match.group(1)
        index = match.end()
        start = index
        escaped = False
        while index < len(statement):
            char = statement[index]
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                values.append(statement[start:index])
                break
            index += 1
    return values


def balanced_call_content(text: str, opening_paren_index: int) -> str | None:
    depth = 0
    quote: str | None = None
    escaped = False
    for index in range(opening_paren_index, len(text)):
        char = text[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in {"'", '"', "`"}:
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return text[opening_paren_index + 1 : index]
    return None


def object_keys(value: str) -> set[str]:
    """Extract explicit or shorthand keys from a JavaScript object literal.

    Only key positions immediately following an object/array opener or comma are
    considered. Values and option objects outside the selected call argument are
    not treated as database fields.
    """
    value = value.strip()
    if not value or value[0] not in "{[":
        return set()

    keys: set[str] = set()
    reserved = {"null", "true", "false", "undefined", "return", "const", "let", "var"}

    explicit = re.compile(
        r"(?:^|[\{\[,])\s*(?:['\"]([^'\"]+)['\"]|([A-Za-z_$][A-Za-z0-9_$]*))\s*:"
    )
    for match in explicit.finditer(value):
        key = match.group(1) or match.group(2)
        if key not in reserved and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            keys.add(key)

    # Object shorthand is valid only when the top-level value is an object.
    if value.startswith("{"):
        shorthand = re.compile(
            r"(?:^|[\{,])\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(?=[,}])"
        )
        for match in shorthand.finditer(value):
            key = match.group(1)
            if key not in reserved and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                keys.add(key)
    return keys


@dataclass
class RelationEvidence:
    source_files: set[str] = field(default_factory=set)
    scopes: set[str] = field(default_factory=set)
    operations: set[str] = field(default_factory=set)
    raw_selects: set[str] = field(default_factory=set)
    columns: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))


@dataclass
class RpcEvidence:
    source_files: set[str] = field(default_factory=set)
    scopes: set[str] = field(default_factory=set)
    argument_names: set[str] = field(default_factory=set)


def record_select_columns(
    relation_name: str,
    select_expression: str,
    relations: dict[str, RelationEvidence],
    source_file: str,
) -> None:
    expression = re.sub(r"\s+", " ", select_expression).strip()
    if not expression:
        return
    relations[relation_name].raw_selects.add(expression)
    for token in split_top_level(expression):
        token = token.strip()
        if not token or token == "*":
            continue
        relationship = re.fullmatch(
            r"(?:(?P<alias>[A-Za-z_][A-Za-z0-9_]*)\s*:\s*)?(?P<target>[A-Za-z_][A-Za-z0-9_]*)(?:![A-Za-z0-9_]+)?\s*\((?P<nested>.*)\)",
            token,
            flags=re.S,
        )
        if relationship:
            alias = relationship.group("alias")
            target = relationship.group("target")
            main_column = target if alias else None
            if main_column:
                relations[relation_name].columns[main_column].add("relationship")
            nested_relation = alias or target
            relations[nested_relation].source_files.add(source_file)
            relations[nested_relation].scopes.add("relationship_inferred")
            relations[nested_relation].operations.add("select_related")
            record_select_columns(
                nested_relation,
                relationship.group("nested"),
                relations,
                source_file,
            )
            continue
        alias_field = re.fullmatch(
            r"[A-Za-z_][A-Za-z0-9_]*\s*:\s*([A-Za-z_][A-Za-z0-9_]*)(?:![A-Za-z0-9_]+)?",
            token,
        )
        if alias_field:
            relations[relation_name].columns[alias_field.group(1)].add("select")
            continue
        simple = re.fullmatch(r"([A-Za-z_][A-Za-z0-9_]*)(?:![A-Za-z0-9_]+)?", token)
        if simple:
            relations[relation_name].columns[simple.group(1)].add("select")


def scan_source() -> tuple[dict, dict, dict, dict]:
    active_files = active_frontend_files()
    all_frontend = [
        path.resolve()
        for path in (ROOT / "src").rglob("*")
        if path.is_file() and path.suffix in JS_EXTENSIONS
    ]
    netlify_files = [path.resolve() for path in (ROOT / "netlify" / "functions").rglob("*.js")]

    relations: dict[str, RelationEvidence] = defaultdict(RelationEvidence)
    rpcs: dict[str, RpcEvidence] = defaultdict(RpcEvidence)
    buckets: dict[str, dict[str, set[str]]] = defaultdict(
        lambda: {"source_files": set(), "scopes": set(), "operations": set()}
    )

    scan_files = all_frontend + netlify_files
    for path in scan_files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        source_file = relpath(path)
        if path in netlify_files:
            scope = "netlify_function"
        elif path in active_files:
            scope = "frontend_bundle"
        else:
            scope = "dormant_source"

        storage_spans: list[tuple[int, int]] = []
        storage_pattern = re.compile(r"\.storage\s*\.from\(\s*['\"]([^'\"]+)['\"]\s*\)")
        for match in storage_pattern.finditer(text):
            name = match.group(1)
            storage_spans.append(match.span())
            statement = scan_to_statement_end(text, match.start())
            buckets[name]["source_files"].add(source_file)
            buckets[name]["scopes"].add(scope)
            for operation in ("upload", "download", "remove", "list", "createSignedUrl", "getPublicUrl", "update"):
                if f".{operation}(" in statement:
                    buckets[name]["operations"].add(operation)

        def inside_storage(index: int) -> bool:
            return any(start <= index < end for start, end in storage_spans)

        from_pattern = re.compile(r"\.from\(\s*['\"]([^'\"]+)['\"]\s*\)")
        for match in from_pattern.finditer(text):
            if inside_storage(match.start()):
                continue
            relation_name = match.group(1)
            evidence = relations[relation_name]
            evidence.source_files.add(source_file)
            evidence.scopes.add(scope)
            statement = scan_to_statement_end(text, match.start())

            for method, operation in (
                ("select", "select"),
                ("insert", "insert"),
                ("upsert", "upsert"),
                ("update", "update"),
                ("delete", "delete"),
            ):
                if f".{method}(" in statement:
                    evidence.operations.add(operation)

            for select_expression in string_call_arguments(statement, "select"):
                record_select_columns(relation_name, select_expression, relations, source_file)

            column_method_pattern = re.compile(
                r"\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|overlaps|match|order)\(\s*['\"]([A-Za-z_][A-Za-z0-9_]*)['\"]"
            )
            for column_match in column_method_pattern.finditer(statement):
                column = column_match.group(1)
                method_text = statement[column_match.start() : column_match.start() + 20]
                evidence.columns[column].add("order" if ".order" in method_text else "filter")

            for mutation_method in ("insert", "upsert", "update"):
                call_pattern = re.compile(rf"\.{mutation_method}\s*\(")
                for call in call_pattern.finditer(statement):
                    opening = statement.find("(", call.start())
                    content = balanced_call_content(statement, opening)
                    if content is not None:
                        arguments = split_top_level(content)
                        payload = arguments[0] if arguments else content
                        for key in object_keys(payload):
                            evidence.columns[key].add(mutation_method)

        rpc_pattern = re.compile(r"\.rpc\(\s*['\"]([^'\"]+)['\"]")
        for match in rpc_pattern.finditer(text):
            name = match.group(1)
            evidence = rpcs[name]
            evidence.source_files.add(source_file)
            evidence.scopes.add(scope)
            opening = text.find("(", match.start())
            content = balanced_call_content(text, opening)
            if content:
                parts = split_top_level(content)
                if len(parts) >= 2:
                    for key in object_keys(parts[1]):
                        evidence.argument_names.add(key)

    route_text = (ROOT / "src" / "App.jsx").read_text(encoding="utf-8", errors="ignore")
    routes = [
        {"path": route, "component": component}
        for route, component in re.findall(
            r"<Route\s+path=['\"]([^'\"]+)['\"]\s+element=\{<([A-Za-z_$][A-Za-z0-9_$]*)\s*/>\}",
            route_text,
        )
    ]

    return relations, rpcs, buckets, {"routes": routes}


def write_contract() -> dict:
    relations, rpcs, buckets, app = scan_source()

    relation_rows = []
    column_rows = []
    for name, evidence in sorted(relations.items()):
        required = bool(evidence.scopes & {"frontend_bundle", "netlify_function"})
        relation_rows.append(
            {
                "schema_name": "public",
                "relation_name": name,
                "required": required,
                "usage_scopes": sorted(evidence.scopes),
                "operations": sorted(evidence.operations),
                "source_files": sorted(evidence.source_files),
                "raw_selects": sorted(evidence.raw_selects),
            }
        )
        for column_name, evidence_types in sorted(evidence.columns.items()):
            column_rows.append(
                {
                    "schema_name": "public",
                    "relation_name": name,
                    "column_name": column_name,
                    "required": required,
                    "evidence_types": sorted(evidence_types),
                    "source_files": sorted(evidence.source_files),
                }
            )

    rpc_rows = []
    for name, evidence in sorted(rpcs.items()):
        required = bool(evidence.scopes & {"frontend_bundle", "netlify_function"})
        rpc_rows.append(
            {
                "schema_name": "public",
                "function_name": name,
                "required": required,
                "usage_scopes": sorted(evidence.scopes),
                "expected_argument_names": sorted(evidence.argument_names),
                "source_files": sorted(evidence.source_files),
            }
        )

    bucket_rows = []
    for name, evidence in sorted(buckets.items()):
        required = bool(evidence["scopes"] & {"frontend_bundle", "netlify_function"})
        bucket_rows.append(
            {
                "bucket_name": name,
                "required": required,
                "usage_scopes": sorted(evidence["scopes"]),
                "operations": sorted(evidence["operations"]),
                "source_files": sorted(evidence["source_files"]),
            }
        )

    contract = {
        "contract_version": CONTRACT_VERSION,
        "generated_from": "React source import graph plus all deployed Netlify functions",
        "safety_note": "Object names and explicit columns are source-derived. Data types and destructive DDL are intentionally not inferred.",
        "summary": {
            "relations": len(relation_rows),
            "required_relations": sum(row["required"] for row in relation_rows),
            "columns": len(column_rows),
            "rpc_functions": len(rpc_rows),
            "required_rpc_functions": sum(row["required"] for row in rpc_rows),
            "storage_buckets": len(bucket_rows),
            "routes": len(app["routes"]),
        },
        "application": app,
        "relations": relation_rows,
        "columns": column_rows,
        "rpc_functions": rpc_rows,
        "storage_buckets": bucket_rows,
    }

    contract_dir = ROOT / "supabase" / "contract"
    contract_dir.mkdir(parents=True, exist_ok=True)
    (contract_dir / "application_database_contract.json").write_text(
        json.dumps(contract, indent=2) + "\n", encoding="utf-8"
    )

    def write_csv(filename: str, rows: list[dict], fields: list[str]) -> None:
        with (contract_dir / filename).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            for row in rows:
                output = dict(row)
                for key, value in list(output.items()):
                    if isinstance(value, list):
                        output[key] = " | ".join(value)
                writer.writerow({field: output.get(field, "") for field in fields})

    write_csv(
        "relations.csv",
        relation_rows,
        ["schema_name", "relation_name", "required", "usage_scopes", "operations", "source_files"],
    )
    write_csv(
        "columns.csv",
        column_rows,
        ["schema_name", "relation_name", "column_name", "required", "evidence_types", "source_files"],
    )
    write_csv(
        "rpc_functions.csv",
        rpc_rows,
        ["schema_name", "function_name", "required", "usage_scopes", "expected_argument_names", "source_files"],
    )
    write_csv(
        "storage_buckets.csv",
        bucket_rows,
        ["bucket_name", "required", "usage_scopes", "operations", "source_files"],
    )
    return contract


if __name__ == "__main__":
    contract = write_contract()
    print(json.dumps(contract["summary"], indent=2))
