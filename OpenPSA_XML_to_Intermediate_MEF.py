import json
from collections import defaultdict
import xml.etree.ElementTree as ET
from itertools import count
import os

# Helper to parse expression (Value in TS)
def parse_expression(elem):
    if elem is None:
        return None
    tag = elem.tag
    if tag == 'float':
        return float(elem.attrib['value'])
    elif tag == 'int':
        return int(elem.attrib['value'])
    elif tag == 'bool':
        return elem.attrib['value'] == 'true'
    elif tag == 'parameter':
        return {'name': elem.attrib['name']}
    elif tag == 'exponential':
        return {'exponential': [parse_expression(c) for c in elem]}
    elif tag == 'GLM':
        return {'GLM': [parse_expression(c) for c in elem]}
    elif tag == 'Weibull':
        return {'Weibull': [parse_expression(c) for c in elem]}
    elif tag == 'periodicTest':
        return {'periodicTest': [parse_expression(c) for c in elem]}
    # Add more built-ins and operations as needed
    # For random deviates
    elif tag == 'uniform-deviate':
        return {'uniformDeviate': [parse_expression(c) for c in elem]}
    elif tag == 'normal-deviate':
        return {'normalDeviate': [parse_expression(c) for c in elem]}
    elif tag == 'lognormal-deviate':
        return {'lognormalDeviate': [parse_expression(c) for c in elem]}
    elif tag == 'gamma-deviate':
        return {'gammaDeviate': [parse_expression(c) for c in elem]}
    elif tag == 'beta-deviate':
        return {'betaDeviate': [parse_expression(c) for c in elem]}
    elif tag == 'histogram':
        bins = []
        for b in elem:
            if b.tag == 'bin':
                bins.append([parse_expression(list(b)[0]), parse_expression(list(b)[1])])
        return {'histogram': {'base': None, 'bins': bins}}  # Adjust if base is present
    # Numerical operations
    elif tag in ['add', 'sub', 'mul', 'div', 'min', 'max', 'mean']:
        return {tag: [parse_expression(c) for c in elem]}
    elif tag in ['neg', 'abs', 'acos', 'asin', 'atan', 'cos', 'cosh', 'exp', 'log', 'log10', 'sin', 'sinh', 'tan', 'tanh', 'sqrt', 'ceil', 'floor']:
        return {tag: parse_expression(list(elem)[0])}
    elif tag == 'mod':
        return {'mod': [parse_expression(c) for c in elem]}
    elif tag == 'pow':
        return {'pow': [parse_expression(c) for c in elem]}
    elif tag == 'pi':
        return {'pi': None}
    # Add more as needed
    return None

def collect_children(elem, gate_defs, name_gen, parent_name):
    children = []
    for ch in elem:
        if 'name' in ch.attrib:
            ch_tag = ch.tag
            ch_name = ch.attrib['name']
            children.append((ch_tag, ch_name))
        else:
            if ch.tag == 'constant':
                gen_name = next(name_gen)
                value = ch.attrib['value'] == 'true'
                gate_defs[gen_name] = {'type': 'constant', 'value': value}
                children.append(('gate', gen_name))
            else:
                # Nested logic
                sub_type = ch.tag
                sub_extra = {}
                if sub_type == 'atleast':
                    sub_extra['min'] = int(ch.attrib['min'])
                elif sub_type == 'cardinality':
                    sub_extra['min'] = int(ch.attrib['min'])
                    sub_extra['max'] = int(ch.attrib['max'])
                # Recurse
                sub_children = collect_children(ch, gate_defs, name_gen, parent_name)
                gen_name = f"{parent_name}_sub{next(name_gen)}"
                gate_defs[gen_name] = {'type': sub_type, 'children': sub_children, **sub_extra}
                children.append(('gate', gen_name))
    return children

# Parse Gate recursively
def build_gate(g_name, gate_defs):
    gd = gate_defs.get(g_name)
    if gd is None:
        return None
    if gd['type'] == 'constant':
        return {
            'name': g_name,
            'type': 'or',
            'gates': [],
            'events': [{'name': g_name + '_const', 'type': 'house', 'value': gd['value']}]
        }
    gates = []
    events = []
    for ch_type, ch_name in gd['children']:
        if ch_type == 'gate':
            sub_gate = build_gate(ch_name, gate_defs)
            if sub_gate:
                gates.append(sub_gate)
        elif 'event' in ch_type:
            e_type = ch_type.replace('-event', '').replace('event', '') or 'basic'
            if e_type == 'basic':
                e_type = 'basic'
            elif e_type == 'house':
                e_type = 'house'
            elif e_type == '':
                e_type = 'undeveloped'  # or default
            events.append({'name': ch_name, 'type': e_type})
    gate = {
        'name': g_name,
        'type': gd['type'],
        'gates': gates,
        'events': events
    }
    if 'min' in gd:
        gate['min'] = gd['min']
    if 'max' in gd:
        gate['max'] = gd['max']
    return gate

# Parse FaultTree
def parse_fault_tree(elem, ccf_groups_global):
    ft_name = elem.attrib['name']
    description = ""
    label = elem.find('label')
    if label is not None:
        description = label.text
    else:
        desc = elem.find('description')
        if desc is not None:
            description = desc.text
    gate_defs = {}
    ccf_groups = []
    name_gen_global = count()
    for child in elem:
        if child.tag == 'define-gate':
            g_name = child.attrib['name']
            if len(list(child)) == 0:
                continue
            formula = list(child)[0]
            g_type = formula.tag
            extra = {}
            if g_type == 'atleast':
                extra['min'] = int(formula.attrib['min'])
            elif g_type == 'cardinality':
                extra['min'] = int(formula.attrib['min'])
                extra['max'] = int(formula.attrib['max'])
            name_gen = (str(next(name_gen_global)) for _ in count())
            children = collect_children(formula, gate_defs, name_gen, g_name)
            gate_defs[g_name] = {'type': g_type, 'children': children, **extra}
        elif child.tag == 'define-CCF-group':
            ccf_groups.append(parse_ccf_group(child))
    # Find root
    all_children = set()
    for g in gate_defs.values():
        for t, n in g['children']:
            if t == 'gate':
                all_children.add(n)
    roots = [n for n in gate_defs if n not in all_children]
    if len(roots) != 1:
        if 'TOP' in gate_defs:
            root_name = 'TOP'
        else:
            root_name = list(gate_defs.keys())[0]  # or raise
    else:
        root_name = roots[0]
    top_event = build_gate(root_name, gate_defs)
    return {
        'name': ft_name,
        'description': description,
        'topEvent': top_event,
        'ccfGroups': ccf_groups
    }

# Parse CCFGroup
def parse_ccf_group(elem):
    name = elem.attrib['name']
    model = elem.attrib['model']
    description = ""
    label = elem.find('label')
    if label is not None:
        description = label.text
    else:
        desc = elem.find('description')
        if desc is not None:
            description = desc.text
    members_elem = elem.find('members')
    members = [m.attrib['name'] for m in members_elem] if members_elem is not None else []
    dist_elem = elem.find('distribution')
    distribution = parse_expression(list(dist_elem)[0]) if dist_elem is not None else None
    factors = []
    facts_elem = elem.find('factors')
    if facts_elem is not None:
        for f in facts_elem:
            level = f.attrib.get('level')
            factor_value = parse_expression(list(f)[0])
            factors.append({'level': int(level) if level else None, 'factorValue': factor_value})
    return {
        'name': name,
        'description': description,
        'model': model,
        'members': members,
        'distribution': distribution,
        'factors': factors
    }

# Recursive parse branch for event sequences
def parse_branch(elem, current_path, sequences, ft_map):
    for child in elem:
        if child.tag == 'fork':
            fe = child.attrib['functional-event']
            for path in child:
                if path.tag == 'path':
                    state = path.attrib['state']
                    formula_elem = path.find('collect-formula')
                    if formula_elem is not None:
                        inner = list(formula_elem)[0]
                        is_not = inner.tag == 'not'
                        state_ts = 'success' if is_not else 'failure'
                        gate_elem = list(inner)[0] if is_not else inner
                        if gate_elem.tag == 'gate':
                            gate_full_name = gate_elem.attrib['name']
                            parts = gate_full_name.split('.')
                            ft_name = '.'.join(parts[:-1]) if parts[-1] == 'TOP' else '.'.join(parts)
                            if ft_name in ft_map:
                                fe_obj = {'name': fe, 'state': state_ts, 'refGate': ft_name}
                                new_path = current_path + [fe_obj]
                                parse_branch(path, new_path, sequences, ft_map)
        elif child.tag == 'sequence':
            end_state = child.attrib['name']
            sequences.append({'functionalEvents': current_path, 'endState': end_state})

# Parse EventTree
def parse_event_tree(elem, ft_map, initiating_events_map):
    et_name = elem.attrib['name']
    description = ""
    label = elem.find('label')
    if label is not None:
        description = label.text
    else:
        desc = elem.find('description')
        if desc is not None:
            description = desc.text
    # Functional events are defined, but not used in TS
    sequences = []
    initial_state = elem.find('initial-state')
    if initial_state is not None:
        parse_branch(initial_state, [], sequences, ft_map)
    initiating_events = initiating_events_map[et_name]
    return {
        'name': et_name,
        'description': description,
        'initiatingEvents': initiating_events,
        'eventSequences': sequences
    }

# Parse InitiatingEvent
def parse_initiating_event(elem):
    name = elem.attrib['name']
    description = ""
    label = elem.find('label')
    if label is not None:
        description = label.text
    else:
        desc = elem.find('description')
        if desc is not None:
            description = desc.text
    # No frequency in examples, set default
    frequency = 0.0  # or parse if present in attributes or children
    unit = 'yr-1'
    # Group if present
    group = None
    # Assuming no group in examples
    return {
        'name': name,
        'description': description,
        'group': group,
        'frequency': frequency,
        'unit': unit
    }

# Main parse model
def parse_model(root, file_name):
    model = {}
    if root.tag != 'opsa-mef':
        raise ValueError("Not a valid OpenPSA MEF XML")
    attrib_name = root.attrib.get('name')
    model['name'] = attrib_name if attrib_name else os.path.splitext(file_name)[0]
    label = root.find('label')
    model['description'] = label.text if label is not None else ""
    ft_map = {}
    event_trees = []
    fault_trees = []
    ccf_groups = []
    initiating_events_map = defaultdict(list)
    basic_event_values = {}
    model_data = []
    for elem in root:
        if elem.tag == 'define-event-tree':
            # Parse later after ft_map
            event_trees.append(elem)
        elif elem.tag == 'define-fault-tree':
            ft = parse_fault_tree(elem, ccf_groups)
            fault_trees.append(ft)
            ft_map[ft['name']] = ft
        elif elem.tag == 'define-CCF-group':
            ccf_groups.append(parse_ccf_group(elem))
        elif elem.tag == 'define-initiating-event':
            et_name = elem.attrib.get('event-tree')
            if et_name:
                initiating_events_map[et_name].append(parse_initiating_event(elem))
        elif elem.tag == 'model-data':
            for child in elem:
                if child.tag == 'define-basic-event':
                    be_name = child.attrib['name']
                    description = ""
                    value = None
                    for sub in child:
                        if sub.tag == 'label':
                            description = sub.text
                        elif sub.tag == 'description':
                            description = sub.text
                        else:  # Assume the rest is the value expression
                            value = parse_expression(sub)
                    if value is not None:
                        param = {
                            'name': be_name,
                            'description': description,
                            'value': value
                        }
                        model_data.append(param)
                elif child.tag == 'define-parameter':
                    param_name = child.attrib['name']
                    description = ""
                    value = None
                    unit = child.attrib.get('unit')
                    for sub in child:
                        if sub.tag == 'label':
                            description = sub.text
                        elif sub.tag == 'description':
                            description = sub.text
                        else:
                            value = parse_expression(sub)
                    if value is not None:
                        param = {
                            'name': param_name,
                            'description': description,
                            'value': value,
                            'unit': unit
                        }
                        model_data.append(param)
                # Add house-event, etc.
    # Now parse event trees with ft_map
    parsed_event_trees = []
    for et_elem in event_trees:
        parsed_event_trees.append(parse_event_tree(et_elem, ft_map, initiating_events_map))
    model['eventTrees'] = parsed_event_trees
    model['faultTrees'] = fault_trees
    model['ccfGroups'] = ccf_groups
    model['modelData'] = model_data
    # Assign values to basic events
    def assign_values_to_gate(gate):
        for event in gate.get('events', []):
            if event.get('type') == 'basic':
                v = basic_event_values.get(event['name'])
                if v is not None:
                    event['value'] = v
        for sub_gate in gate.get('gates', []):
            assign_values_to_gate(sub_gate)
    for ft in fault_trees:
        assign_values_to_gate(ft['topEvent'])
    # Note: refGates in event trees share the same dicts, so values are assigned
    return model

# For Colab
from google.colab import files
uploaded = files.upload()
if uploaded:
    file_name = list(uploaded.keys())[0]
    with open(file_name, 'wb') as f:
        f.write(uploaded[file_name])
    tree = ET.parse(file_name)
    root = tree.getroot()
    model = parse_model(root, file_name)
    ts_output = "export const model: Model = " + json.dumps(model, indent=2) + ";"
    print(ts_output)
else:
    print("No file uploaded")