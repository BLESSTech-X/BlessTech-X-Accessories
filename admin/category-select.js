/* PhoneYa2 Decap CMS dynamic category selector.
   Categories are managed as Product Categories entries. The final option opens
   the category editor in a separate tab so the current product draft is retained. */
(function () {
  'use strict';
  if (!window.CMS || typeof window.createClass !== 'function' || typeof window.h !== 'function') return;
  var h = window.h;
  var fallback = [
    { slug: 'case', title: 'Phone Cases' },
    { slug: 'charger', title: 'Chargers' },
    { slug: 'cable', title: 'Cables' },
    { slug: 'earphone', title: 'Earphones & Headsets' },
    { slug: 'powerbank', title: 'Power Banks' },
    { slug: 'protector', title: 'Screen Protectors' },
    { slug: 'phone', title: 'Phones' },
    { slug: 'watch', title: 'Watches & Smartwatches' },
    { slug: 'accessory', title: 'Other Phone Accessories' },
    { slug: 'other', title: 'Other / Miscellaneous' },
    { slug: 'perfumes', title: 'Perfumes' }
  ];
  var CategoryControl = window.createClass({
    getInitialState: function () {
      return { categories: fallback, loading: false, error: '' };
    },
    componentDidMount: function () { this.loadCategories(); },
    loadCategories: function () {
      var self = this;
      self.setState({ loading: true, error: '' });
      fetch('/content/product-categories/index.json?refresh=' + Date.now(), { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('Category list is not published yet.');
          return response.json();
        })
        .then(function (rows) {
          if (!Array.isArray(rows)) throw new Error('The category index is invalid.');
          var valid = rows.filter(function (row) { return row && row.slug && row.active !== false; });
          self.setState({ categories: valid.length ? valid : fallback, loading: false, error: '' });
        })
        .catch(function (error) {
          self.setState({ categories: fallback, loading: false, error: error.message || 'Using the built-in category list.' });
        });
    },
    openCategoryEditor: function () {
      window.open('/admin/#/collections/product_categories/new', '_blank', 'noopener');
    },
    handleChange: function (event) {
      var value = event.target.value;
      if (value === '__add_new_category__') {
        this.openCategoryEditor();
        event.target.value = this.props.value || '';
        return;
      }
      this.props.onChange(value);
    },
    render: function () {
      var self = this;
      var options = [
        h('option', { key: 'empty', value: '' }, 'Select a category')
      ].concat(this.state.categories.map(function (category) {
        return h('option', { key: category.slug, value: category.slug }, category.title || category.slug);
      }));
      options.push(h('option', { key: 'add-category', value: '__add_new_category__' }, '＋ Add new category'));
      return h('div', { className: 'py2-category-control' },
        h('select', {
          id: this.props.forID,
          className: this.props.classNameWrapper,
          value: this.props.value || '',
          onChange: this.handleChange,
          'aria-label': 'Product category'
        }, options),
        h('div', { className: 'py2-category-control-actions' },
          h('button', { type: 'button', onClick: function () { self.loadCategories(); }, disabled: this.state.loading },
            this.state.loading ? 'Refreshing…' : 'Refresh categories'),
          h('button', { type: 'button', onClick: this.openCategoryEditor }, '＋ Create category')
        ),
        this.state.error ? h('small', { className: 'py2-category-control-note' }, this.state.error) :
          h('small', { className: 'py2-category-control-note' }, 'New categories appear here after their CMS entry is saved and the site rebuild completes.')
      );
    }
  });
  var CategoryPreview = window.createClass({
    render: function () {
      var label = this.props.value || 'No category selected';
      return h('span', {}, label);
    }
  });

  var ProductSetupControl = window.createClass({
    updateField: function (key, value) {
      var next = Object.assign({}, this.props.value || {});
      next.enabled = key === 'enabled' ? Boolean(value) : true;
      if (key !== 'enabled') next[key] = value;
      this.props.onChange(next);
    },
    render: function () {
      var self = this;
      var value = this.props.value || {};
      function field(label, key, placeholder, multiline) {
        var control = multiline
          ? h('textarea', { value: value[key] || '', placeholder: placeholder || '', rows: 3, onChange: function (e) { self.updateField(key, e.target.value); } })
          : h('input', { type: 'text', value: value[key] || '', placeholder: placeholder || '', onChange: function (e) { self.updateField(key, e.target.value); } });
        return h('label', { className: 'py2-other-product-field', key: key },
          h('span', {}, label), control);
      }
      return h('div', { className: 'py2-other-product-setup' },
        h('label', { className: 'py2-other-product-toggle' },
          h('input', {
            type: 'checkbox',
            checked: Boolean(value.enabled),
            onChange: function (e) { self.updateField('enabled', e.target.checked); }
          }),
          h('span', {}, 'Other PhoneYa2 Product'),
          h('small', {}, 'Turn ON for perfumes and products outside the phone-accessories range.')
        ),
        value.enabled ? h('div', { className: 'py2-other-product-fields' },
          field('Brand', 'brand', 'e.g. Lattafa, Armaf'),
          field('Variant / Model', 'variant', 'Product variant or model'),
          field('Size / Volume', 'size', 'e.g. 30ml, 50ml, 100ml'),
          field('Scent Family', 'scent_family', 'e.g. woody, floral, fresh'),
          field('Fragrance Concentration', 'concentration', 'e.g. Eau de Parfum'),
          field('Scent Notes', 'scent_notes', 'Enter confirmed fragrance notes', true),
          field('Additional Specifications', 'specifications', 'Other useful product details', true)
        ) : h('small', { className: 'py2-other-product-hint' }, 'OFF — the normal phone-accessories product form stays in use. Turn ON to reveal the additional product fields.')
      );
    }
  });
  window.CMS.registerWidget('other-product-setup', ProductSetupControl);

  window.CMS.registerWidget('category-select', CategoryControl, CategoryPreview);
})();
