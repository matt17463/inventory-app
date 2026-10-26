(function ($) {
  'use strict';

  function attributeKey(element) {
    return String($(element).data('attribute_name') || element.name || '').toLowerCase();
  }

  function selectorFields($form) {
    const $selects = $form.find('select[name^="attribute_"], select[data-attribute_name^="attribute_"]');
    const $color = $selects.filter(function () {
      return attributeKey(this) === 'attribute_pa_color' || attributeKey(this) === 'attribute_color';
    }).first();
    const $size = $selects.filter(function () {
      return attributeKey(this) === 'attribute_pa_size' || attributeKey(this) === 'attribute_size';
    }).first();
    const $logo = $selects.filter(function () {
      return attributeKey(this).includes('logo');
    }).first();
    return { $color, $size, $logo };
  }

  function setAvailable($field, available) {
    if (!$field.length) return;
    $field.prop('disabled', !available);
    $field.attr('aria-disabled', available ? 'false' : 'true');
    $field.closest('tr, .value').toggleClass('sc-mockup-selector-locked', !available);
  }

  function hideUnavailableOptions($field, active) {
    if (!$field.length) return;
    $field.find('option').each(function () {
      const isChoice = String(this.value || '') !== '';
      this.hidden = Boolean(active && isChoice && this.disabled);
    });
  }

  function refreshSequence($form) {
    const { $color, $size, $logo } = selectorFields($form);
    if (!$color.length || !$size.length || !$logo.length) return;

    const hasColor = String($color.val() || '') !== '';
    const hasSize = hasColor && String($size.val() || '') !== '';
    setAvailable($size, hasColor);
    setAvailable($logo, hasSize);
    hideUnavailableOptions($size, hasColor);
    hideUnavailableOptions($logo, hasSize);
  }

  function clearField($field) {
    if (!$field.length || String($field.val() || '') === '') return;
    $field.val('').trigger('change');
  }

  function initializeForm($form) {
    if ($form.data('sc-mockup-selector-ready')) return;
    const { $color, $size, $logo } = selectorFields($form);
    if (!$color.length || !$size.length || !$logo.length) return;

    $form.data('sc-mockup-selector-ready', true);
    $form.addClass('sc-mockup-dependent-variations');

    $color.on('change.scMockupSelector', function () {
      clearField($size);
      clearField($logo);
      window.setTimeout(function () { refreshSequence($form); }, 0);
    });

    $size.on('change.scMockupSelector', function () {
      clearField($logo);
      window.setTimeout(function () { refreshSequence($form); }, 0);
    });

    $form.on('woocommerce_update_variation_values.scMockupSelector reset_data.scMockupSelector', function () {
      window.setTimeout(function () { refreshSequence($form); }, 0);
    });

    // WooCommerce supplies the exact resolved variation; PHP validates its mapped family.
    const clearGraphic = function () { $form.find('input[data-sc-canonical-graphic]').val(''); };
    $form.on('found_variation.scGraphicBridge', function (_event, variation) {
      let $hidden = $form.find('input[data-sc-canonical-graphic]');
      if (!variation.sc_graphic_bridge_enabled) { $hidden.remove(); return; }
      if (!$hidden.length) {
        $hidden = $('<input>', {type:'hidden', name:'sc_graphic_family_id', 'data-sc-canonical-graphic':'1'}).appendTo($form);
      }
      $hidden.val(variation.sc_graphic_family_id || '');
    });
    $form.on('woocommerce_variation_select_change.scGraphicBridge reset_data.scGraphicBridge hide_variation.scGraphicBridge', clearGraphic);
    refreshSequence($form);
  }

  function initializeAll() {
    $('form.variations_form').each(function () {
      initializeForm($(this));
    });
  }

  $(initializeAll);
  $(document.body).on('wc_variation_form.scMockupSelector', 'form.variations_form', function () {
    initializeForm($(this));
  });
})(jQuery);
