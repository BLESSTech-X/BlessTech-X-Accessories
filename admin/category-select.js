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
  window.CMS.registerWidget('category-select', CategoryControl, CategoryPreview);
})();
