/*!
 * VisualEditor UserInterface MediaSizeWidget class.
 *
 * @copyright 2011-2018 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Widget that lets the user edit dimensions (width and height),
 * based on a scalable object.
 *
 * @class
 * @extends OO.ui.Widget
 *
 * @constructor
 * @param {ve.dm.Scalable} [scalable] A scalable object
 * @param {Object} [config] Configuration options
 * @cfg {boolean} [noDefaultDimensions] The item being sized doesn't have default dimensions
 * @cfg {boolean} [noOriginalDimensions] The item being sized doesn't have original dimensions
 */
ve.ui.MediaSizeWidget = function VeUiMediaSizeWidget( scalable, config ) {
	var fieldCustom;

	// Configuration
	config = config || {};

	this.scalable = scalable;

	// Parent constructor
	ve.ui.MediaSizeWidget.super.call( this, config );

	// Properties
	this.ratio = {};
	this.currentDimensions = {};
	this.maxDimensions = {};
	this.valid = null;
	this.noDefaultDimensions = !!config.noDefaultDimensions;
	this.noOriginalDimensions = !!config.noOriginalDimensions;

	// Define button select widget
	this.sizeTypeSelectWidget = new OO.ui.ButtonSelectWidget( {
		classes: [ 've-ui-mediaSizeWidget-section-sizetype' ]
	} );
	this.sizeTypeSelectWidget.addItems( [
		new OO.ui.ButtonOptionWidget( {
			data: 'default',
			label: ve.msg( 'visualeditor-mediasizewidget-sizeoptions-default' )
		} ),
		// TODO: when upright is supported by Parsoid
		// new OO.ui.ButtonOptionWidget( {
		// data: 'scale',
		// label: ve.msg( 'visualeditor-mediasizewidget-sizeoptions-scale' )
		// } ),
		new OO.ui.ButtonOptionWidget( {
			data: 'custom',
			label: ve.msg( 'visualeditor-mediasizewidget-sizeoptions-custom' )
		} )
	] );

	// Define scale
	this.scaleInput = new OO.ui.TextInputWidget();
	// scalePercentLabel = new OO.ui.LabelWidget( {
	// 	input: this.scaleInput,
	// 	label: ve.msg( 'visualeditor-mediasizewidget-label-scale-percent' )
	// } );

	this.dimensionsWidget = new ve.ui.DimensionsWidget( { validate: this.isValid.bind( this ) } );

	// Error label is available globally so it can be displayed and
	// hidden as needed
	this.errorLabel = new OO.ui.LabelWidget( {
		label: ve.msg( 'visualeditor-mediasizewidget-label-defaulterror' )
	} );

	// Field layouts
	// fieldScale = new OO.ui.FieldLayout(
	// 	this.scaleInput, {
	// 		align: 'right',
	// 		// TODO: when upright is supported by Parsoid
	// 		// classes: ['ve-ui-mediaSizeWidget-section-scale'],
	// 		label: ve.msg( 'visualeditor-mediasizewidget-label-scale' )
	// 	}
	// );
	// TODO: when upright is supported by Parsoid
	// this.scaleInput.$element.append( scalePercentLabel.$element );
	fieldCustom = new OO.ui.FieldLayout(
		this.dimensionsWidget, {
			align: 'right',
			classes: [ 've-ui-mediaSizeWidget-section-custom' ]
		}
	);
	if ( !this.noDefaultDimensions || !this.noOriginalDimensions ) {
		fieldCustom.setLabel( ve.msg( 'visualeditor-mediasizewidget-label-custom' ) );
	}

	// Buttons
	this.fullSizeButton = new OO.ui.ButtonWidget( {
		label: ve.msg( 'visualeditor-mediasizewidget-button-originaldimensions' ),
		classes: [ 've-ui-mediaSizeWidget-button-fullsize' ]
	} );

	// Build GUI
	this.$element.addClass( 've-ui-mediaSizeWidget' );
	if ( !this.noDefaultDimensions ) {
		this.$element.append( this.sizeTypeSelectWidget.$element );
	}
	this.$element.append( fieldCustom.$element );
	if ( !config.noOriginalDimensions ) {
		this.$element.append(
			// TODO: when upright is supported by Parsoid
			// fieldScale.$element,
			this.fullSizeButton.$element,
			$( '<div>' )
				.addClass( 've-ui-mediaSizeWidget-label-error' )
				.append( this.errorLabel.$element )
		);
	}

	// Events
	this.dimensionsWidget.connect( this, {
		widthChange: [ 'onDimensionsChange', 'width' ],
		heightChange: [ 'onDimensionsChange', 'height' ]
	} );
	// TODO: when upright is supported by Parsoid
	// this.scaleInput.connect( this, { change: 'onScaleChange' } );
	this.sizeTypeSelectWidget.connect( this, { choose: 'onSizeTypeChoose' } );
	this.fullSizeButton.connect( this, { click: 'onFullSizeButtonClick' } );

};

/* Inheritance */

OO.inheritClass( ve.ui.MediaSizeWidget, OO.ui.Widget );

/* Events */

/**
 * @event change
 * @param {Object} dimensions Width and height dimensions
 */

/**
 * @event valid
 * @param {boolean} isValid Current dimensions are valid
 */

/**
 * @event changeSizeType
 * @param {string} sizeType 'default', 'custom' or 'scale'
 */

/* Methods */

/**
 * Respond to change in original dimensions in the scalable object.
 * Specifically, enable or disable to 'set full size' button and the 'default' option.
 *
 * @param {Object} dimensions Original dimensions
 */
ve.ui.MediaSizeWidget.prototype.onScalableOriginalSizeChange = function ( dimensions ) {
	var disabled = !dimensions || ve.isEmptyObject( dimensions );
	this.fullSizeButton.setDisabled( disabled );
	this.sizeTypeSelectWidget.findItemFromData( 'default' ).setDisabled( disabled );
	// Revalidate current dimensions
	this.validateDimensions();
};

/**
 * Respond to change in current dimensions in the scalable object.
 *
 * @param {Object} dimensions Original dimensions
 */
ve.ui.MediaSizeWidget.prototype.onScalableCurrentSizeChange = function ( dimensions ) {
	if ( !ve.isEmptyObject( dimensions ) ) {
		this.setCurrentDimensions( dimensions );
		this.validateDimensions();
	}
};

/**
 * Respond to default size or status change in the scalable object.
 *
 * @param {boolean} isDefault Current default state
 */
ve.ui.MediaSizeWidget.prototype.onScalableDefaultSizeChange = function ( isDefault ) {
	// Update the default size into the dimensions widget
	this.updateDefaultDimensions();
	// TODO: When 'scale' ('upright' support) is ready, this will need to be adjusted
	// to support that as well
	this.setSizeType(
		isDefault ?
			'default' :
			'custom'
	);
	this.validateDimensions();
};

/**
 * Respond to width/height input value change. Only update dimensions if
 * the value is numeric. Invoke validation for every change.
 *
 * This is triggered every time the dimension widget has its values changed
 * either by the user or externally. The external call to 'setCurrentDimensions'
 * will result in this event being evoked if the dimension inputs have changed,
 * and same with clicking the 'full size' button and changing dimensions type.
 * The 'change' event for the entire widget is emitted through this method, as
 * it means that the actual values have changed, regardless of whether they
 * are valid or not.
 *
 * @param {string} type The input that was updated, 'width' or 'height'
 * @param {string} value The new value of the input
 * @fires change
 */
ve.ui.MediaSizeWidget.prototype.onDimensionsChange = function ( type, value ) {
	var dimensions = {};

	if ( Number( value ) === 0 && !this.noDefaultDimensions ) {
		this.setSizeType( 'default' );
	} else {
		this.setSizeType( 'custom' );
		if ( $.isNumeric( value ) ) {
			dimensions[ type ] = Number( value );
			this.setCurrentDimensions( dimensions );
		} else {
			this.validateDimensions();
		}
	}
};

/**
 * Respond to change of the scale input
 */
ve.ui.MediaSizeWidget.prototype.onScaleChange = function () {
	// If the input changed (and not empty), set to 'custom'
	// Otherwise, set to 'default'
	if ( !this.dimensionsWidget.isEmpty() ) {
		this.sizeTypeSelectWidget.selectItemByData( 'scale' );
	} else {
		this.sizeTypeSelectWidget.selectItemByData( 'default' );
	}
};

/**
 * Respond to size type change
 *
 * @param {OO.ui.OptionWidget} item Selected size type item
 * @fires changeSizeType
 */
ve.ui.MediaSizeWidget.prototype.onSizeTypeChoose = function ( item ) {
	var selectedType = item.getData(),
		wasDefault = this.scalable.isDefault();

	this.scalable.toggleDefault( selectedType === 'default' );

	if ( selectedType === 'default' ) {
		this.scaleInput.setDisabled( true );
		// If there are defaults, put them into the values
		if ( !ve.isEmptyObject( this.dimensionsWidget.getDefaults() ) ) {
			this.dimensionsWidget.clear();
		}
	} else if ( selectedType === 'scale' ) {
		// Disable the dimensions widget
		this.dimensionsWidget.setDisabled( true );
		// Enable the scale input
		this.scaleInput.setDisabled( false );
	} else if ( selectedType === 'custom' ) {
		// Enable the dimensions widget
		this.dimensionsWidget.setDisabled( false );
		// Disable the scale input
		this.scaleInput.setDisabled( true );
		// If we were default size before, set the current dimensions to the default size
		if ( wasDefault && !ve.isEmptyObject( this.dimensionsWidget.getDefaults() ) ) {
			this.setCurrentDimensions( this.dimensionsWidget.getDefaults() );
		}
		this.validateDimensions();
	}

	this.emit( 'changeSizeType', selectedType );
	this.validateDimensions();
};

/**
 * Set the placeholder value of the scale input
 *
 * @param {number} value Placeholder value
 */
ve.ui.MediaSizeWidget.prototype.setScalePlaceholder = function ( value ) {
	this.scaleInput.$element.prop( 'placeholder', value );
};

/**
 * Get the placeholder value of the scale input
 *
 * @return {string} Placeholder value
 */
ve.ui.MediaSizeWidget.prototype.getScalePlaceholder = function () {
	return this.scaleInput.$element.prop( 'placeholder' );
};

/**
 * Select a size type in the select widget
 *
 * @param {string} sizeType The size type to select
 */
ve.ui.MediaSizeWidget.prototype.setSizeType = function ( sizeType ) {
	if (
		this.getSizeType() !== sizeType ||
		// If the dimensions widget has zeros make sure to
		// allow for the change in size type
		Number( this.dimensionsWidget.getWidth() ) === 0 ||
		Number( this.dimensionsWidget.getHeight() ) === 0
	) {
		this.sizeTypeSelectWidget.chooseItem(
			this.sizeTypeSelectWidget.findItemFromData( sizeType )
		);
	}
};
/**
 * Get the size type from the select widget
 *
 * @return {string} The size type
 */
ve.ui.MediaSizeWidget.prototype.getSizeType = function () {
	return this.sizeTypeSelectWidget.findSelectedItem() ? this.sizeTypeSelectWidget.findSelectedItem().getData() : '';
};

/**
 * Set the scalable object the widget deals with
 *
 * @param {ve.dm.Scalable} scalable A scalable object representing the media source being resized.
 */
ve.ui.MediaSizeWidget.prototype.setScalable = function ( scalable ) {
	if ( this.scalable instanceof ve.dm.Scalable ) {
		this.scalable.disconnect( this );
	}
	this.scalable = scalable;
	// Events
	this.scalable.connect( this, {
		defaultSizeChange: 'onScalableDefaultSizeChange',
		originalSizeChange: 'onScalableOriginalSizeChange',
		currentSizeChange: 'onScalableCurrentSizeChange'
	} );

	this.updateDefaultDimensions();

	if ( !this.scalable.isDefault() ) {
		// Reset current dimensions to new scalable object
		this.setCurrentDimensions( this.scalable.getCurrentDimensions() );
	}

	// If we don't have original dimensions, disable the full size button
	if ( !this.scalable.getOriginalDimensions() ) {
		this.fullSizeButton.setDisabled( true );
		this.sizeTypeSelectWidget.findItemFromData( 'default' ).setDisabled( true );
	} else {
		this.fullSizeButton.setDisabled( false );
		this.sizeTypeSelectWidget.findItemFromData( 'default' ).setDisabled( false );

		// Call for the set size type according to default or custom settings of the scalable
		this.setSizeType( this.scalable.isDefault() ? 'default' : 'custom' );
	}
	this.validateDimensions();
};

/**
 * Get the attached scalable object
 *
 * @return {ve.dm.Scalable} The scalable object representing the media
 * source being resized.
 */
ve.ui.MediaSizeWidget.prototype.getScalable = function () {
	return this.scalable;
};

/**
 * Handle click events on the full size button.
 * Set the width/height values to the original media dimensions
 */
ve.ui.MediaSizeWidget.prototype.onFullSizeButtonClick = function () {
	this.sizeTypeSelectWidget.chooseItem(
		this.sizeTypeSelectWidget.findItemFromData( 'custom' )
	);
	this.setCurrentDimensions( this.scalable.getOriginalDimensions() );
	this.dimensionsWidget.setDisabled( false );
};

/**
 * Set the image aspect ratio explicitly
 *
 * @param {number} ratio Numerical value of an aspect ratio
 */
ve.ui.MediaSizeWidget.prototype.setRatio = function ( ratio ) {
	this.scalable.setRatio( ratio );
};

/**
 * Get the current aspect ratio
 *
 * @return {number} Aspect ratio
 */
ve.ui.MediaSizeWidget.prototype.getRatio = function () {
	return this.scalable.getRatio();
};

/**
 * Set the maximum dimensions for the image. These will be limited only if
 * enforcedMax is true.
 *
 * @param {Object} dimensions Height and width
 */
ve.ui.MediaSizeWidget.prototype.setMaxDimensions = function ( dimensions ) {
	// Normalize dimensions before setting
	var maxDimensions = ve.dm.Scalable.static.getDimensionsFromValue( dimensions, this.scalable.getRatio() );
	this.scalable.setMaxDimensions( maxDimensions );
};

/**
 * Retrieve the currently defined maximum dimensions
 *
 * @return {Object} dimensions Height and width
 */
ve.ui.MediaSizeWidget.prototype.getMaxDimensions = function () {
	return this.scalable.getMaxDimensions();
};

/**
 * Retrieve the current dimensions
 *
 * @return {Object} Width and height
 */
ve.ui.MediaSizeWidget.prototype.getCurrentDimensions = function () {
	return this.currentDimensions;
};

/**
 * @inheritdoc
 */
ve.ui.MediaSizeWidget.prototype.setDisabled = function ( disabled ) {
	// Parent method
	ve.ui.MediaSizeWidget.super.prototype.setDisabled.call( this, disabled );

	// The 'setDisabled' method seems to be called before the widgets
	// are fully defined. So, before disabling/enabling anything,
	// make sure the objects exist
	if ( this.sizeTypeSelectWidget &&
		this.dimensionsWidget &&
		this.scalable &&
		this.fullSizeButton
	) {
		// Disable the type select
		this.sizeTypeSelectWidget.setDisabled( disabled );

		// Disable the dimensions widget
		this.dimensionsWidget.setDisabled( disabled );

		// Double negatives aren't never fun!
		this.fullSizeButton.setDisabled(
			// Disable if asked to disable
			disabled ||
			// Only enable if the scalable has
			// the original dimensions available
			!this.scalable.getOriginalDimensions()
		);
	}
};

/**
 * Updates the current dimensions in the inputs, either one at a time or both
 *
 * @param {Object} dimensions Dimensions with width and height
 * @fires change
 */
ve.ui.MediaSizeWidget.prototype.setCurrentDimensions = function ( dimensions ) {
	var normalizedDimensions;

	// Recursion protection
	if ( this.preventChangeRecursion ) {
		return;
	}
	this.preventChangeRecursion = true;

	if ( !this.scalable.isFixedRatio() ) {
		dimensions = ve.extendObject( {}, this.getCurrentDimensions(), dimensions );
	}

	// Normalize the new dimensions
	normalizedDimensions = ve.dm.Scalable.static.getDimensionsFromValue( dimensions, this.scalable.getRatio() );

	if (
		// Update only if the dimensions object is valid
		ve.dm.Scalable.static.isDimensionsObjectValid( normalizedDimensions ) &&
		// And only if the dimensions object is not default
		!this.scalable.isDefault()
	) {
		this.currentDimensions = normalizedDimensions;
		// This will only update if the value has changed
		// Set width & height individually as they may be 0
		this.dimensionsWidget.setWidth( this.currentDimensions.width );
		this.dimensionsWidget.setHeight( this.currentDimensions.height );

		// Update scalable object
		this.scalable.setCurrentDimensions( this.currentDimensions );

		this.validateDimensions();
		// Emit change event
		this.emit( 'change', this.currentDimensions );
	}
	this.preventChangeRecursion = false;
};

/**
 * Validate current dimensions.
 * Explicitly call for validating the current dimensions. This is especially
 * useful if we've changed conditions for the widget, like limiting image
 * dimensions for thumbnails when the image type changes. Triggers the error
 * class if needed.
 *
 * @return {boolean} Current dimensions are valid
 */
ve.ui.MediaSizeWidget.prototype.validateDimensions = function () {
	var isValid = this.isValid();

	if ( this.valid !== isValid ) {
		this.valid = isValid;
		this.errorLabel.toggle( !isValid );
		this.dimensionsWidget.setValidityFlag();
		// Emit change event
		this.emit( 'valid', this.valid );
	}
	return isValid;
};

/**
 * Set default dimensions for the widget. Values are given by scalable's
 * defaultDimensions. If no default dimensions are available,
 * the defaults are removed.
 */
ve.ui.MediaSizeWidget.prototype.updateDefaultDimensions = function () {
	var defaultDimensions = this.scalable.getDefaultDimensions();

	if ( !ve.isEmptyObject( defaultDimensions ) ) {
		this.dimensionsWidget.setDefaults( defaultDimensions );
	} else {
		this.dimensionsWidget.removeDefaults();
	}
	this.sizeTypeSelectWidget.findItemFromData( 'default' ).setDisabled(
		ve.isEmptyObject( defaultDimensions )
	);
	this.validateDimensions();
};

/**
 * Check if the custom dimensions are empty.
 *
 * @return {boolean} Both width/height values are empty
 */
ve.ui.MediaSizeWidget.prototype.isCustomEmpty = function () {
	return this.dimensionsWidget.isEmpty();
};

/**
 * Toggle a disabled state for the full size button
 *
 * @param {boolean} isDisabled Disabled or not
 */
ve.ui.MediaSizeWidget.prototype.toggleFullSizeButtonDisabled = function ( isDisabled ) {
	this.fullSizeButton.setDisabled( isDisabled );
};

/**
 * Check if the scale input is empty.
 *
 * @return {boolean} Scale input value is empty
 */
ve.ui.MediaSizeWidget.prototype.isScaleEmpty = function () {
	return ( this.scaleInput.getValue() === '' );
};

/**
 * Check if all inputs are empty.
 *
 * @return {boolean} All input values are empty
 */
ve.ui.MediaSizeWidget.prototype.isEmpty = function () {
	return ( this.isCustomEmpty() && this.isScaleEmpty() );
};

/**
 * Check whether the current value inputs are valid
 * 1. If placeholders are visible, the input is valid
 * 2. If inputs have non numeric values, input is invalid
 * 3. If inputs have numeric values, validate through scalable
 *    calculations to see if the dimensions follow the rules.
 *
 * @return {boolean} Valid or invalid dimension values
 */
ve.ui.MediaSizeWidget.prototype.isValid = function () {
	var itemType = this.sizeTypeSelectWidget.findSelectedItem() ?
		this.sizeTypeSelectWidget.findSelectedItem().getData() : 'custom';

	// TODO: when upright is supported by Parsoid add validation for scale

	if ( itemType === 'custom' ) {
		if (
			this.dimensionsWidget.getDefaults() &&
			this.dimensionsWidget.isEmpty()
		) {
			return true;
		} else if (
			$.isNumeric( this.dimensionsWidget.getWidth() ) &&
			$.isNumeric( this.dimensionsWidget.getHeight() )
		) {
			return this.scalable.isCurrentDimensionsValid();
		} else {
			return false;
		}
	} else {
		// Default images are always valid size
		return true;
	}
};
