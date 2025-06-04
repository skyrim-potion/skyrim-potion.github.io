import data from './data.json' with { type: 'json' };

const { a, button, div, h1, h3, option, select, span, table, thead, tbody, td, th, tr } = van.tags

const ASSERT_ON = true

/**
 * @template T
 * @typedef {Object} Van
 * @property {T} val
 * @property {T} oldVal
 * @property {T} rawVal
 */

/**
 * @template T
 * @param {T} t
 * @returns {Van<T>}
 */
const vstate = (t) => van.state(t)

/**
 * @template T
 * @param {() => T} f
 * @returns {Van<T>}
 */
const vderive = (f) => van.derive(f)

/**
 * @typedef {Object} EffectMagnitudeDuration
 * @property {string} effect 
 * @property {number} magnitude
 * @property {number} duration
 */
/**
 * @typedef {Object} IngredientMagnitudeDuration
 * @property {string} ingredient 
 * @property {number} magnitude
 * @property {number} duration
 */

/** @type {Object.<string, IngredientMagnitudeDuration>} */
const effects = Object.entries(data)
    .flatMap(([i, es]) => Object.entries(es).map(([e, md]) =>
        [e, { 'ingredient': i, 'magnitude': md.magnitude, 'duration': md.duration }]))
    .reduce((acc, [e, imd]) => {
        if (!acc[e]) acc[e] = [];
        acc[e].push(imd);
        return acc;
    }, {});

/**
 * 
 * @param {string} ingredient 
 * @returns {EffectMagnitudeDuration[]}
 */
function ingredient_effects(ingredient) {
    var effect_data = [];
    for (const [effect, magdur] of Object.entries(data[ingredient] ?? {})) {
        effect_data.push({ effect: effect, magnitude: magdur.magnitude, duration: magdur.duration })
    }
    return effect_data;
}

/**
 * 
 * @param {string[]} ingredients
 * @returns {EffectMagnitudeDuration[]} 
 */
function ingredients_effects(ingredients) {
    var effects_counter = {};
    for (const ingredient of ingredients) {
        for (const effect_mag_dur of ingredient_effects(ingredient)) {
            if (effects_counter[effect_mag_dur.effect]) {
                const effect_counter = effects_counter[effect_mag_dur.effect];
                effect_counter.counter += 1;
                effect_counter.magnitude = Math.max(effect_counter.magnitude, effect_mag_dur.magnitude);
                effect_counter.duration = Math.max(effect_counter.duration, effect_mag_dur.duration);
            } else {
                effects_counter[effect_mag_dur.effect] = {
                    counter: 1,
                    magnitude: effect_mag_dur.magnitude,
                    duration: effect_mag_dur.duration,
                }
            }
        }
    }
    return Object.entries(effects_counter).flatMap(([effect, d]) => d.counter >= 2 ? [{ effect: effect, magnitude: d.magnitude, duration: d.duration }] : []);
}

/**
 * 
 * @param {string[]} other_ingredients
 * @param {string} expected_effect
 * @returns {string[]}
 */
function none_or_filtered_ingredients(other_ingredients, expected_effect) {
    var ingredients = [];
    const effects = other_ingredients.reduce((acc, i) => acc.union(new Set(ingredient_effects(i).map(i => i.effect))), new Set([]));
    for (const [ingredient, ingredient_effects] of Object.entries(data)) {
        if (other_ingredients.length != 0 && other_ingredients.includes(ingredient)) continue;
        for (const effect of Object.keys(ingredient_effects)) {
            if (expected_effect !== '' && effect !== expected_effect) continue;
            if (other_ingredients.length == 0 || effects.has(effect)) {
                ingredients.push(ingredient);
                break;
            }
        }
    }
    ingredients.unshift('');
    return ingredients;
}

const ingredient_info_string = (ingredient) =>
    Object.entries(data[ingredient] ?? []).map(([e, magdurs]) => e + ' (mag: ' + magdurs.magnitude + ', dur: ' + magdurs.duration + ')').join('\n');


/**
 * 
 * @param {string} id
 * @param {Van<string>[]} other_ingredients_states 
 * @param {Van<string>} selected_ingredient_state
 * @param {(any) => ()} onchange
 */
const Ingredient = (n, other_ingredients_states, selected_ingredient_state, onchange) => {
    const effect_filter = vstate('');

    const filtered_ingredients = vderive(() =>
        none_or_filtered_ingredients(other_ingredients_states.map((i) => i.val), effect_filter.val)
            .map(i => option({ title: ingredient_info_string(i), selected: () => selected_ingredient_state.val == i }, i)));

    const ingredient_select = () => select({
        oninput: e => { onchange(e), selected_ingredient_state.val = e.target.value },
        title: vderive(() => ingredient_info_string(selected_ingredient_state.val))
    }, filtered_ingredients.val);

    const effect_filter_options = vderive(() => {
        var res = []
        if (other_ingredients_states.length >= 1) {
            var effect_options = {}
            for (const ingredient_state of other_ingredients_states) {
                for (const effect of ingredient_effects(ingredient_state.val)) {
                    effect_options[effect.effect] = (effect_options[effect.effect] ?? 0) + 1;
                }
            }
            res = Object.entries(effect_options).flatMap(ec => ec[1] == 1 ? [ec[0]] : []);
        } else {
            res = Object.keys(effects);
        }
        res.sort();
        res.unshift('');
        return res.map(e => option({ value: e }, e));
    });

    const effect_select = () => select({
        title: 'Select an effect',
        onchange: (e) => { effect_filter.val = e.target.value },
        disabled: vderive(() => selected_ingredient_state.val !== ''),
    }, effect_filter_options.val);

    const potion_effects = () => {
        var effects = Object.entries(data[selected_ingredient_state.val] ?? [])
            .map(([e, magdurs]) => tr(td(e), td(magdurs.magnitude), td(magdurs.duration)));
        return table(effects);
    };

    const should_be_empty = vderive(() => other_ingredients_states.length > 0 &&
        other_ingredients_states.some((i) => i.val == ''));

    const remove_ingredient = () => selected_ingredient_state.val != '' ?
        button({
            title: 'Remove ingredient',
            onclick: () => { onchange(), selected_ingredient_state.val = ''; }
        }, 'X') :
        span();

    return () => should_be_empty.val ? tr(td(), td(), td()) : tr(
        td(ingredient_select, ' ', remove_ingredient),
        td(effect_select),
        td(potion_effects),
    );
};

const IngredientsToPotion = (mode) => {
    const ingredient1 = vstate('');
    const ingredient2 = vstate('');
    const ingredient3 = vstate('');

    const ingredient1form = Ingredient('1', [], ingredient1, () => { ingredient3.val = ''; ingredient2.val = '' });
    const ingredient2form = Ingredient('2', [ingredient1], ingredient2, () => ingredient3.val = '');
    const ingredient3form = Ingredient('3', [ingredient1, ingredient2], ingredient3, () => { });

    const ingredient_table = vderive(() => {
        return div(
            h1("Ingredients Selection"),
            h3(a({ onclick: () => mode.val = 'effects' }, 'Switch to Effects Selection')),
            table({ id: 'ingredients' },
                thead(
                    tr(th('Ingredient'), th({ title: 'Filters the Ingredients by effect' }, 'Effect Filter'), th('Effects (Name, Magnitude, Duration)'))
                ),
                tbody(ingredient1form, ingredient2form, ingredient3form)
            )
        );
    });

    const effects_div = vderive(() => {
        if (ingredient2.val == '') return div();

        return div(
            h1("Potion"),
            table({ id: 'potion' },
                thead(
                    tr(th('Effect'), th('Magnitude'), th('Duration'))
                ),
                tbody(
                    ingredients_effects([ingredient1.val, ingredient2.val, ingredient3.val]).map(e =>
                        tr(td(e.effect), td(e.magnitude), td(e.duration))
                    )
                )
            )
        );
    });

    return div(ingredient_table, effects_div);
}

/**
 * @param {n} number
 * @param {Van<string[]>} effects_selected
 */
const EffectSelector = (n, effects_selected, reset) => {

    const selected = vstate(false);

    const options = vderive(() => {
        var options = Object.keys(effects)
            .filter(e => !effects_selected.val.includes(e));
        options.sort();
        options.unshift('');
        return options.map(s => option({ value: s }, s));
    });

    const reset_effects = () => {
        reset();
        var new_effects_selected = structuredClone(effects_selected.val);
        while (new_effects_selected.length > n) new_effects_selected.pop();
        effects_selected.val = new_effects_selected;
        selected.val = false;
    };

    const effect_selector = select({
        onchange: e => {
            reset_effects();
            if (e.target.value != '') {
                effects_selected.val = effects_selected.val.concat(e.target.value);
                selected.val = true;
            }
        }
    }, options.val);

    const remove_effect = () => selected.val != '' ?
        button({
            title: 'Remove effect',
            onclick: () => { reset_effects(); effect_selector.value = ''; }
        }, 'X') :
        span();

    return div(
        div("Effect: ", effect_selector, ' ', remove_effect),
        () => selected.val != '' ? EffectSelector(n + 1, effects_selected, reset) : div(),
    );
}

const Effects = (mode, effects) => {

    const effects_selected = vstate([]);

    return div(
        h1("Effects Selection"),
        h3(a({ onclick: () => mode.val = 'ingredients' }, 'Switch to Ingredients Selection')),
        EffectSelector(0, effects_selected, () => effects.val = []),
        vderive(() => effects_selected.val.length == 0 ? div() : button({ onclick: () => { effects.val = effects_selected.val } }, 'Find Potions')),
    );
}

/** @param {Van<string[]>} effects_submitted */
const PotionsTable = (effects_submitted) => () => {
    if (effects_submitted.val.length == 0) {
        return div();
    }

    var candidates = [];
    for (const effect of effects_submitted.val) {
        const ingredients = effects[effect];
        if (candidates.length == 0) {
            for (let i = 0; i < ingredients.length; i++) {
                for (let j = i + 1; j < ingredients.length; j++) {
                    candidates.push({
                        [ingredients[i].ingredient]: {
                            [effect]: {
                                magnitude: ingredients[i].magnitude,
                                duration: ingredients[i].duration,
                            }
                        },
                        [ingredients[j].ingredient]: {
                            [effect]: {
                                magnitude: ingredients[j].magnitude,
                                duration: ingredients[j].duration,
                            }
                        },
                    });
                }
            }
        } else {
            var old_candidates = candidates;
            candidates = [];
            for (const candidate of old_candidates) {
                const matches = ingredients.filter(i => i.ingredient in candidate);

                for (const match of matches) {
                    candidate[match.ingredient][effect] = {
                        magnitude: match.magnitude,
                        duration: match.duration,
                    }
                }

                // the effect is already in candidate
                if (matches.length >= 2) {
                    candidates.push(candidate_clone);
                    continue;
                }

                if (matches.length < 1) continue;

                // only one ingredient in candidate has the effect, we need to find another one but
                // only if candidate has less than 3 ingredients
                if (candidate.length >= 3) continue;

                for (const ingredient of ingredients) {
                    if (!(ingredient.ingredient in candidate)) {
                        const candidate_clone = structuredClone(candidate);
                        candidate_clone[ingredient.ingredient] = {
                            [effect]: {
                                magnitude: ingredient.magnitude,
                                duration: ingredient.duration,
                            }
                        };
                        candidates.push(candidate_clone);
                    }
                }
            }
        }
    }


    // TODO: first collect so you can sort

    var sort_by = vstate(['ingredients', '', 'ASC']);

    var rows = [];
    for (const candidate of candidates) {
        var cells = [td(Object.keys(candidate).join(' + '))];
        for (const effect of effects_submitted.val) {
            var mag = 0, dur = 0, mag_i = '', dur_i = '';
            for (const [i, effects] of Object.entries(candidate)) {
                if (mag < effects[effect]?.magnitude ?? 0) {
                    mag = effects[effect]?.magnitude;
                    mag_i = i;
                }
                if (dur < effects[effect]?.duration ?? 0) {
                    dur = effects[effect]?.duration;
                    dur_i = i;
                }
            }
            cells.push(td({ title: `${effect} magnitude (${mag_i})` }, mag));
            cells.push(td({ title: `${effect} duration (${dur_i})` }, dur));
        }
        rows.push(tr(cells));
    }

    const sort_ord_reverse = (sort_ord) => sort_ord == 'DESC' ? 'ASC' : 'DESC';

    const sort_onclick = (sort_by_type, sort_by_val, sort_ord_default) => () => {
        const new_sort_ord = sort_by.val[0] == sort_by_type && sort_by.val[1] == sort_by_val ? sort_ord_reverse(sort_by.val[2]) : sort_ord_default;
        sort_by.val = [sort_by_type, sort_by_val, new_sort_ord];
    };

    const sort_icon = (sort_by_type, sort_by_val) => () =>
        sort_by.val[0] == sort_by_type && sort_by.val[1] == sort_by_val ? (sort_by.val[2] == 'DESC' ? '▼' : '▲') : '▽';

    const body = () => {
        const [sort_by_type, sort_by_val, sort_ord] = sort_by.val;
        // console.log(`Sort by ${sort_by_type} ${sort_by_val}`);
        var sorted_rows = rows.toSorted((l, r) => {
            if (sort_by_type == 'ingredients') {
                const comp_res = l.children[0].innerHTML.localeCompare(r.children[0].innerHTML);
                return sort_ord == 'DESC' ? comp_res * -1 : comp_res;
            }
            const offset = sort_by_type == 'mag' ? 0 : 1;
            const effect_index = effects_submitted.val.indexOf(sort_by_val);
            const index = 1 + effect_index * 2 + offset;
            const lc = Number(l.children[index].innerHTML);
            const rc = Number(r.children[index].innerHTML);
            const comp_res = lc < rc ? -1 : 1;
            return sort_ord == 'DESC' ? comp_res * -1 : comp_res;
        });
        sorted_rows.unshift(tr([td()].concat(effects_submitted.val.flatMap(e => [
            td('mag ', span({ onclick: sort_onclick('mag', e, 'DESC'), title: `Sort by ${e} magnitude` }, sort_icon('mag', e))),
            td('dur ', span({ onclick: sort_onclick('dur', e, 'DESC'), title: `Sort by ${e} duration` }, sort_icon('dur', e)))]))
        ));
        return tbody(sorted_rows);
    };

    return div(
        table(
            thead(
                tr([th('Ingredients ',
                    span({ onclick: sort_onclick('ingredients', '', 'ASC'), title: 'Sort by Ingredients' }, sort_icon('ingredients', '')))]
                    .concat(effects_submitted.val.map(e => th({ colspan: 2 }, e))))
            ),
            body,
        )
    );
}

const EffectsToPotions = (mode) => {
    const effects = vstate([]);

    return div(Effects(mode, effects), PotionsTable(effects));
}

const App = () => {

    const mode = vstate('ingredients');

    return div({ class: "app" },
        () => mode.val == 'ingredients' ? IngredientsToPotion(mode) : div(),
        () => mode.val == 'effects' ? EffectsToPotions(mode) : div(),
    );
};

window.onload = () => { van.add(document.body, App()) };