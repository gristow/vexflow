// [VexFlow](http://vexflow.com) - Copyright (c) Mohit Muthanna 2010.
//
// ## Description
//
// This file implements text annotations as modifiers that can be attached to
// notes.
//
// See `tests/annotation_tests.js` for usage examples.
Vex.Flow.Annotation = (function() {
  function Annotation(text) {
    if (arguments.length > 0) this.init(text);
  }

  Annotation.CATEGORY = "annotations";
  var Modifier = Vex.Flow.Modifier;

  // To enable logging for this class. Set `Vex.Flow.Annotation.DEBUG` to `true`.
  function L() { if (Annotation.DEBUG) Vex.L("Vex.Flow.Annotation", arguments); }

  // Text annotations can be positioned and justified relative to the note.
  Annotation.Justify = {
    LEFT: 1,
    CENTER: 2,
    RIGHT: 3,
    CENTER_STEM: 4
  };

  Annotation.VerticalJustify = {
    TOP: 1,
    CENTER: 2,
    BOTTOM: 3,
    CENTER_STEM: 4
  };

  // Arrange annotations within a `ModifierContext`
  Annotation.format = function(annotations, state) {
    if (!annotations || annotations.length === 0) return false;

    let left_shift = 0;
    let right_shift = 0;
    let width = 0;
    annotations.forEach((annotation) => {
      width = annotation.getWidth();
      if (annotation.getPosition() === Modifier.Position.ABOVE) {
        annotation.setTextLine(state.top_text_line);
        state.top_text_line++;
      } else {
        annotation.setTextLine(state.text_line);
        state.text_line++;
      }
      switch (annotation.justification) {
        case Annotation.Justify.CENTER:
        case Annotation.Justify.CENTER_STEM:
          left_shift = Math.max(left_shift, width / 2);
          right_shift = Math.max(right_shift, width / 2);
          break;
        case Annotation.Justify.LEFT:
          left_shift = Math.max(left_shift, 0);
          right_shift = Math.max(right_shift, width);
          break;
        case Annotation.Justify.RIGHT:
          left_shift = Math.max(left_shift, width);
          right_shift = Math.max(right_shift, 0);
          break;
      }
    });

    console.log('left_shift', left_shift);
    console.log('right_shift', right_shift);
    console.log('width', width);
    state.left_shift += left_shift;
    state.right_shift += right_shift;
    return true;
  };

  // ## Prototype Methods
  //
  // Annotations inherit from `Modifier` and is positioned correctly when
  // in a `ModifierContext`.
  Vex.Inherit(Annotation, Modifier, {
    // Create a new `Annotation` with the string `text`.
    init: function(text) {
      Annotation.superclass.init.call(this);

      this.note = null;
      this.index = null;
      this.text = text;
      this.justification = Annotation.Justify.CENTER;
      this.vert_justification = Annotation.VerticalJustify.TOP;
      this.font = {
        family: "Arial",
        size: 10,
        weight: ""
      };

      // The default width is calculated from the text.
      this.setWidth(Vex.Flow.textWidth(text));
    },

    // Set vertical position of text (above or below stave). `just` must be
    // a value in `Annotation.VerticalJustify`.
    setVerticalJustification: function(just) {
      this.vert_justification = just;
      return this;
    },

    // Get and set horizontal justification. `justification` is a value in
    // `Annotation.Justify`.
    getJustification: function() { return this.justification; },
    setJustification: function(justification) {
      this.justification = justification;
      return this;
    },

    setY: function(y) {
      this.y = y;
    },

    // Render text beside the note.
    draw: function() {
      if (!this.context) throw new Vex.RERR("NoContext",
        "Can't draw text annotation without a context.");
      if (!this.note) throw new Vex.RERR("NoNoteForAnnotation",
        "Can't draw text annotation without an attached note.");

      var start = this.note.getModifierStartXY(Modifier.Position.ABOVE,
          this.index);

      // We're changing context parameters. Save current state.
      this.context.save();
      this.applyStyle();
      this.context.setFont(this.font.family, this.font.size, this.font.weight);
      var text_width = this.context.measureText(this.text).width;

      // Estimate text height to be the same as the width of an 'm'.
      //
      // This is a hack to work around the inability to measure text height
      // in HTML5 Canvas (and SVG).
      var text_height = this.context.measureText("m").width;
      var x, y = this.y;

      if (this.justification == Annotation.Justify.LEFT) {
        x = start.x;
      } else if (this.justification == Annotation.Justify.RIGHT) {
        x = start.x - text_width;
      } else if (this.justification == Annotation.Justify.CENTER) {
        x = start.x - text_width / 2;
      } else /* CENTER_STEM */ {
        x = this.note.getStemX() - text_width / 2;
      }

      x += this.x_shift;
      var stem_ext, spacing;
      var has_stem = this.note.hasStem();
      var stave = this.note.getStave();
      var bBox;

      // The position of the text varies based on whether or not the note
      // has a stem. Fortunately, getBoundingBox will take that into account
      // for us.
      spacing = stave.getSpacingBetweenLines();

      // If the y placement has been set manually, don't do this.
      if (!y) {
        if (this.vert_justification == Annotation.VerticalJustify.BOTTOM) {
          y = stave.getYForBottomText(this.text_line);
          bBox = this.note.getBoundingBox();
          var bottomY = bBox.y + bBox.h;
          y = Math.max(y, bottomY + (spacing * (this.text_line + 1)) + text_height / 3);
        } else if (this.vert_justification ==
                  Annotation.VerticalJustify.CENTER) {
          var yt = stave.getYForTopText(this.text_line) - 1;
          var yb = stave.getYForBottomText(this.text_line);
          y = yt + ( yb - yt ) / 2 + text_height / 2;
        } else if (this.vert_justification ==
                  Annotation.VerticalJustify.TOP) {
          y = Math.min(stave.getYForTopText(this.text_line), this.note.getBoundingBox().y - (spacing * (this.text_line)) - text_height/3 );
        } else /* CENTER_STEM */{
          var extents = this.note.getStemExtents();
          y = extents.topY + (extents.baseY - extents.topY) / 2 +
            text_height / 2;
        }
      }

      L("Rendering annotation: ", this.text, x, y);
      this.context.fillText(this.text, x, y);
      this.context.restore();
    }
  });

  return Annotation;
}());