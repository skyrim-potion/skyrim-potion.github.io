import data from './data.json' with { type: 'json' };

const { div, h1, option, select, table, thead, tbody, td, th, tr } = van.tags

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

function assert(condition, message) {
    if (ASSERT_ON && !condition) throw new Error(message || "Assertion failed")
}

function assert_eq(fst, snd) {
    assert(fst.toString() === snd.toString(), `"${fst}" != "${snd}"`)
}

/**
 * @template T
 * @template E
 */
class Result {
    /** @type {T} */
    #ok
    /** @type {E} */
    #err
    /**
     * @param {T} ok 
     * @param {E} err
     */
    constructor(ok, err) {
        if ((ok == null && err == null) || (ok != null && err != null)) {
            throw new Error('Result should be either ok or error')
        }
        this.#ok = ok
        this.#err = err
    }

    toString = () => this.map_or_else(e => `Err(${e})`, o => `Ok(${o})`);

    /**
     * @template T
     * @param {T} ok
     * @return {Result<T, null>}
     */
    static ok(ok) { return new Result(ok, null) }

    /**
     * @template E
     * @param {E} err
     * @return {Result<null, E>}
     */
    static err = err => new Result(null, err)

    /** @return {boolean} */
    is_ok = () => this.#ok != null

    /** @return {boolean} */
    is_err = () => this.#err != null

    /**
     * @param {T} def
     * @returns {T}
     */
    get_or = def => this.is_ok() ? this.#ok : def;

    /**
     * @param {E} def
     * @returns {E}
     */
    get_err_or = def => this.is_err() ? this.#err : def;

    /**
     * @returns {T}
     */
    get_or_throw() {
        if (this.is_err()) throw new Error(this.#err)
        return this.#ok
    }

    /**
     * @return {E}
     */
    get_err_or_throw() {
        if (this.is_ok()) throw new Error('This Result is an ok and not an error!')
        return this.#err
    }

    /**
     * @template U
     * @param {function(E): U} fe
     * @param {function(T): U} ft
     * @return {U}
     */
    map_or_else(fe, ft) {
        return this.#ok == null ? fe(this.#err) : ft(this.#ok);
    }
}

{
    assert(Result.ok(1).is_ok())
    assert(!Result.ok(1).is_err())
    assert(Result.err('e').is_err())
    assert(!Result.err('e').is_ok())
    assert(Result.ok(1).get_or(2) == 1)
    assert(Result.ok(1).get_or_throw('e') == 1)
    assert(Result.err(1).get_or(2) == 2)
}

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
            .map((i) => option({ title: ingredient_info_string(i) }, i)));

    const ingredient_select = () => select({
        oninput: (e) => { onchange(e), selected_ingredient_state.val = e.target.value },
        title: vderive(() => ingredient_info_string(selected_ingredient_state.val)),
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

    return () => should_be_empty.val ? tr(td(), td(), td()) : tr(
        td(ingredient_select),
        td(effect_select),
        td(potion_effects),
    );
};

const App = () => {
    const ingredient1 = vstate('');
    const ingredient2 = vstate('');
    const ingredient3 = vstate('');

    vderive(() => console.log(ingredient1, ingredient2, ingredient3));

    const ingredient1form = Ingredient('1', [], ingredient1, () => { ingredient3.val = ''; ingredient2.val = '' });
    const ingredient2form = Ingredient('2', [ingredient1], ingredient2, () => ingredient3.val = '');
    const ingredient3form = Ingredient('3', [ingredient1, ingredient2], ingredient3, () => { });

    const ingredient_table = vderive(() => {
        return div(
            h1("Effects Selection"),
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

    return div({ class: "app" },
        ingredient_table,
        effects_div,
    );
};

window.onload = () => { van.add(document.body, App()) };