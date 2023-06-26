/*! 
 * Round Corners Customization v.0.1.1
 * https://github.com/kefiijrw/Round-Corners-Customization-for-Illustrator
 *
 * Author: Sergey Nikolaev
 * kefiijrw.com
 *
 * Date: 2023-06-26
 *
 * 
 * CHANGELOG:
 * 
 * v.0.0.1 
 * Initial release
 * 
 * v.0.0.2
 * Added a warning when trying to run the script on points without rounding.
 * 
 * Now if a point has handles in both directions, and only one of them is 
 * directed to the other selected point, then only this handle will move.
 * 
 * v.0.0.3
 * Fixed a bug that removed the opposite to the corner handle.
 * 
 * v.0.0.4
 * Option to hide the curvature profile is now avaible in the interface.
 * The language of the settings panel adjusts to the Illustrator locale.
 * 
 * v.0.1.0
 * Public release
 * The script file and the settings window title now have a more specific name.
 * 
 * v.0.1.1
 * Isolation mode support
 * 
 */

//show the settings panel on startup
var ui = true;

//show the curvature profile
var show_profile = true;

//curvature profile color
var curviture_color = newCMYKColor(0, 35, 60, 0);

//do we write in the log file
var debug_mode = false;

//max value of the first coefficient on the slider
var max_coef1 = 3;

//max value of the second coefficient on the slider
var max_coef2 = 1;

//script was run with the shift key pressed
var shifted = false;



//Working with current documents
var doc = app.activeDocument;

var i, p, dxl, dxr, dyl, dyr;

var coefs = [];

var coef1; //point offset 
var coef2; //handle offset
var tmp_layer;

var selectedPointsSaved = [];

//a global flag that remembers if there is something suitable for the script among the selected points
var points_to_move = false;



/*



  SOME HELPING FUNTIONS



*/


// color creation
function newCMYKColor(c, m, y, k) {
   var col = new CMYKColor();
   col.cyan = c;
   col.magenta = m;
   col.yellow = y;
   col.black = k;
   return col;
}


//write a line in the log file (sorry, bad habit)
function echo(what) {
   if (debug_mode)
      log_file.write(what + '\n');
}


// rounding values of coefficients to .000 to show in inputs
function roundOff(x) {

   var place = 1000;
   x = Math.round(x * place);
   x /= place;

   return x;
}


// return the line in the right language, depending on the illustrator's locale
function loc(vars) {
   if (app.locale.indexOf('ru_') == 0)
      return vars.ru;
   else
      return vars.en;
}






/*

  CONFIG OPERATION FUNCTIONS

*/



// Read presets from illustrator settings
function init_configs() {
   echo('init_configs');

   //flag in the illustrator settings saying that the script has already been run before
   var was = app.preferences.getIntegerPreference('corner_smoothing_script_first_launch_already_was');

   if (was != 6) { //very dumb, sorry. it didn't work to save boolean so 6 is true and 2 is false

      //first launch
      echo('first_launch!');

      //default presets
      coefs = [
         {
            "name": "Default",
            "coef1": 0.702,
            "coef2": 0.111
         },
         {
            "name": "big",
            "coef1": 0.494,
            "coef2": 0.171
         },
         {
            "name": "ellipsoid",
            "coef1": 0.682,
            "coef2": 0.365
         }
      ];

      coef1 = coefs[0].coef1; //point 
      coef2 = coefs[0].coef2; //handle

      //save these values in illustrator settings
      from_vars_to_prefs();

      //remember that first launch was
      app.preferences.setIntegerPreference('corner_smoothing_script_first_launch_already_was', 6);


   } else {

      echo('not first launch');

      //not first launch
      //read script settings from illustrator settings
      from_prefs_to_vars();

   }

}

// saving current state (coefficients, presets, checkboxes) to the illustrator settings, so they can be recovered again after restarting the illustrator

function from_vars_to_prefs() {

   echo('from_vars_to_prefs ');

   for (var i = 0; i < coefs.length; i++) {
      echo('set config ' + i + ': ' + coefs[i].name + ', ' + coefs[i].coef1 + ', ' + coefs[i].coef2);
      app.preferences.setStringPreference('corner_smoothing_script_config_' + i + '_name', coefs[i].name);
      app.preferences.setRealPreference('corner_smoothing_script_config_' + i + '_coef1', coefs[i].coef1);
      app.preferences.setRealPreference('corner_smoothing_script_config_' + i + '_coef2', coefs[i].coef2);
   }

   echo('set congifs_count to ' + coefs.length);
   app.preferences.setIntegerPreference("corner_smoothing_script_saved_congifs_count", coefs.length);

   echo('set current coefs to ' + coef1 + ', ' + coef2);

   app.preferences.setRealPreference('corner_smoothing_script_current_coef1', coef1);
   app.preferences.setRealPreference('corner_smoothing_script_current_coef2', coef2);


   var uii = ui ? 6 : 2;
   echo('set ui to ' + uii);
   app.preferences.setIntegerPreference('corner_smoothing_script_show_ui', uii);

   var prof = show_profile ? 6 : 2;
   echo('set show_profile to ' + prof);
   app.preferences.setIntegerPreference('corner_smoothing_script_show_profile', prof);



}


//opposite, restoring the state of the script from the saved illustrator settings

function from_prefs_to_vars() {
   echo('from_prefs_to_vars');

   //how many presets are saved
   var saved_congifs_count = app.preferences.getIntegerPreference('corner_smoothing_script_saved_congifs_count');
   echo(saved_congifs_count);

   //If it is unknown (although this is strange), then let it be 0
   if (saved_congifs_count == undefined || saved_congifs_count < 0 || saved_congifs_count > 10) {
      echo('no corner_smoothing_script_saved_congifs_count or invalid values, set 0');
      saved_congifs_count = 0;
      app.preferences.setIntegerPreference("corner_smoothing_script_saved_congifs_count", 0);
   }

   //if such a variable is not saved in the Illustrator settings, it can give an absurdly large number instead of null or undefined, so cut it out
   if (saved_congifs_count > 40) {
      echo('nooo, terminate');
      saved_congifs_count = 0;
   }

   /*  if(saved_congifs_count == 0 ){
       echo('all presets are gone, strange');
     }*/

   echo(saved_congifs_count + ' configs');

   for (var i = 0; i < saved_congifs_count; i++) {
      var conf = {};
      conf.name = app.preferences.getStringPreference('corner_smoothing_script_config_' + i + '_name');
      conf.coef1 = app.preferences.getRealPreference('corner_smoothing_script_config_' + i + '_coef1');
      conf.coef2 = app.preferences.getRealPreference('corner_smoothing_script_config_' + i + '_coef2');
      echo('coef' + i + ': ' + conf.name + ', ' + conf.coef1 + ', ' + conf.coef2);
      coefs.push(conf);
   }


   coef1 = app.preferences.getRealPreference('corner_smoothing_script_current_coef1');
   coef2 = app.preferences.getRealPreference('corner_smoothing_script_current_coef2');
   var s = app.preferences.getIntegerPreference('corner_smoothing_script_show_ui');
   var p = app.preferences.getIntegerPreference('corner_smoothing_script_show_profile');

   echo(s);
   if (s == 6) {
      echo('ui: true');
      ui = true;
   } else {
      echo('ui: false');
      ui = false;
   }

   echo(p);
   if (p == 6) {
      echo('profile: true');
      show_profile = true;
   } else {
      echo('profile: false');
      show_profile = false;
   }



}

//erase all about script from illustrator settings and write from the variables instead
function update_prefs_from_vars() {
   clear_all_prefs();
   from_vars_to_prefs();
}


//erase all saved settings
function clear_all_prefs() {
   echo('clear_all_prefs:');

   var saved_congifs_count = app.preferences.getIntegerPreference('corner_smoothing_script_saved_congifs_count');
   echo(saved_congifs_count);
   echo(typeof saved_congifs_count);

   //If it is unknown (although this is strange), then let it be 0
   if (saved_congifs_count == undefined || saved_congifs_count < 0 || saved_congifs_count > 10) {
      echo('no corner_smoothing_script_saved_congifs_count, set 0');
      saved_congifs_count = 0;
   }

   for (var i = 0; i < saved_congifs_count; i++) {
      echo('removePreference ' + i);
      app.preferences.removePreference('corner_smoothing_script_config_' + i + '_name');
      app.preferences.removePreference('corner_smoothing_script_config_' + i + '_coef1');
      app.preferences.removePreference('corner_smoothing_script_config_' + i + '_coef2');
   }
   echo('set corner_smoothing_script_saved_congifs_count to 0');
   app.preferences.setIntegerPreference("corner_smoothing_script_saved_congifs_count", 0);

}


//full reset, as if the script had never been run before
function factory_reset() {
   echo('factory_reset');

   clear_all_prefs();

   echo('removePreference corner_smoothing_script_saved_congifs_count');
   app.preferences.removePreference('corner_smoothing_script_saved_congifs_count');

   echo('removePreference corner_smoothing_script_first_launch_already_was');
   app.preferences.removePreference('corner_smoothing_script_first_launch_already_was');

   echo('removePreference corner_smoothing_script_current_coef1');
   echo('removePreference corner_smoothing_script_current_coef2');
   echo('removePreference corner_smoothing_script_show_ui');
   echo('removePreference corner_smoothing_script_show_profile');
   app.preferences.removePreference('corner_smoothing_script_current_coef1');
   app.preferences.removePreference('corner_smoothing_script_current_coef2');
   app.preferences.removePreference('corner_smoothing_script_show_ui');
   app.preferences.removePreference('corner_smoothing_script_show_profile');
}














/*

  CORE FUNCTIONS

*/






//Let's go. We need to process all the corners from what
function go(what) {
   echo('go!');

   //see `what` it is. if it didn't pass, then work with the selection
   if (what == undefined) {
      what = doc.selection;
   }


   if (what.length == 0) {
      alert(loc({'en':'Nothing selected\nSelect paths or individual points and run the script again', 'ru':'Ничего не выделено\nВыделите объекты или отдельные точки и запустите скрипт снова'}));
      return false;
   }


   //go through everything that needs to be processed and sorted out
   for (var i = 0; i < what.length; i++) {

      echo('path' + (i + 1));

      //create a subarray to save the points that will be processed (will be needed later)
      if (selectedPointsSaved[i] === undefined) {
         selectedPointsSaved[i] = [];
      }

      if (what[i].typename == 'PathItem') {

         if (selectedPointsSaved[i].length == 0) {

            echo('NATURAL SELECTED');
            for (var j = 0; j < what[i].pathPoints.length; j++) {
               if (what[i].pathPoints[j].selected == PathPointSelection.ANCHORPOINT) {

                  p = what[i].pathPoints[j];

                  var prev_point_i = (j == 0 ? what[i].pathPoints.length - 1 : j - 1);
                  var next_point_i = (j == what[i].pathPoints.length - 1 ? 0 : j + 1);

                  var is_prev_point_selected = (what[i].pathPoints[prev_point_i].selected == PathPointSelection.ANCHORPOINT);

                  var is_next_point_selected = (what[i].pathPoints[next_point_i].selected == PathPointSelection.ANCHORPOINT);


                  selectedPointsSaved[i].push({ 'n': j, 'prev_selected': is_prev_point_selected, 'next_selected': is_next_point_selected });

                  poiint(p, is_prev_point_selected, is_next_point_selected);
               }
            }


         } else {

            echo('RESTORE SELECTED POINTS');
            for (var j = 0; j < selectedPointsSaved[i].length; j++) {

               p = what[i].pathPoints[selectedPointsSaved[i][j].n];
               poiint(p, selectedPointsSaved[i][j].prev_selected, selectedPointsSaved[i][j].next_selected);
            }


         }

      }
   }

   if (points_to_move == false) {

      alert(loc({'en':'Nothing to tune\nSelect rounded corners and run the script again.', 'ru':'Нечего обрабатывать\nВыделите скругленные углы и запустите скрипт снова.'}));

      return false;

   }

   //draw a curvature profile
   if (show_profile) {
      draw_evolute(what);
   }

   return true;
}


//point processing
function poiint(p, is_prev_point_selected, is_next_point_selected) {
   echo('POINT ' + is_prev_point_selected + ' ' + is_next_point_selected);

   if (p.selected == PathPointSelection.ANCHORPOINT) {

      //measuring the length of the point handles 
      dxl = p.leftDirection[0] - p.anchor[0];
      dyl = p.leftDirection[1] - p.anchor[1];
      dxr = p.rightDirection[0] - p.anchor[0];
      dyr = p.rightDirection[1] - p.anchor[1];

      if (dxl == 0 && dyl == 0 && dxr == 0 && dyr == 0) {
         echo('point without handles');

      } else if (!(dxl == 0 && dyl == 0) && dxr == 0 && dyr == 0) {
         //only the handle to the left
         echo('handle to the left');
         points_to_move = true;

         move_point(p, 'al');

      } else if (dxl == 0 && dyl == 0 && !(dxr == 0 && dyr == 0)) {
         //only the handle to the right

         echo('handle to the right');

         points_to_move = true;

         move_point(p, 'ar');

      } else { //both handles

         echo('both handles');
         points_to_move = true;


         if (is_prev_point_selected && is_next_point_selected) {
            //if both before and after points are selected, then move both handles

            move_point(p, 'rl');


         } else if (is_prev_point_selected) {
            //otherwise move only handle to the other selected point
            move_point(p, 'l');

         } else if (is_next_point_selected) {
            move_point(p, 'r');

         } else {
            //if a point has two handles and the neighbor points are not selected, then move both handles
            move_point(p, 'rl');

         }

      }

   }
}




//moving anchor and handle
function move_point(p, l_or_r) {

   echo('moving point ' + l_or_r);

   //anchor and left handle
   if (l_or_r == 'al') {

      p.anchor = [p.anchor[0] - dxl * coef1, p.anchor[1] - dyl * coef1];
      p.leftDirection = [p.leftDirection[0] + dxl * coef2, p.leftDirection[1] + dyl * coef2];
      p.rightDirection = [p.anchor[0], p.anchor[1]];

      //anchor and right handle
   } else if (l_or_r == 'ar') {

      p.anchor = [p.anchor[0] - dxr * coef1, p.anchor[1] - dyr * coef1];
      p.rightDirection = [p.rightDirection[0] + dxr * coef2, p.rightDirection[1] + dyr * coef2];
      p.leftDirection = [p.anchor[0], p.anchor[1]];

      //only left handle
   } else if (l_or_r == 'l') {

      p.leftDirection = [p.leftDirection[0] + dxl * coef2, p.leftDirection[1] + dyl * coef2];

      //only right handle
   } else if (l_or_r == 'r') {

      p.rightDirection = [p.rightDirection[0] + dxr * coef2, p.rightDirection[1] + dyr * coef2];

      //both handles
   } else if (l_or_r == 'rl') {

      p.rightDirection = [p.rightDirection[0] + dxr * coef2, p.rightDirection[1] + dyr * coef2];
      p.leftDirection = [p.leftDirection[0] + dxl * coef2, p.leftDirection[1] + dyl * coef2];

   }


}

//restore point selection (it is reset for some reason)
function restore_points_selection() {
   echo('RESTORE SELECTED POINTS');

   var what = doc.selection;

   for (i = 0; i < what.length; i++) {

      if (what[i].typename == 'PathItem') {

         for (var j = 0; j < what[i].pathPoints.length; j++) {
            what[i].pathPoints[j].selected = PathPointSelection.NOSELECTION;
         }

         for (var j = 0; j < selectedPointsSaved[i].length; j++) {

            what[i].pathPoints[selectedPointsSaved[i][j].n].selected = PathPointSelection.ANCHORPOINT;

         }

      }

   }


}


























/*



  CURVATURE VISUALIZATION FUNCTIONS



*/



//drawing curvature profile for `what`
function draw_evolute(what) {


   //recursively look around all that was given and for Path start drawing curvature

   for (var i = 0; i < what.length; i++) {

      // draw_evolute_for_path(what[i]);

      switch (what[i].typename) {

         case "PathItem":
            if (what[i].pathPoints.length > 1)
               draw_evolute_for_path(what[i]);
            break;

         case "GroupItem":
            draw_evolute(what[i].pageItems);
            break;

         case "CompoundPathItem":
            draw_evolute(what[i].pathItems);
            break;

         case "TextFrame":
            // maybe sometime
            break;

      }

   }

}






//drawing curvature profile for the opath path
function draw_evolute_for_path(opath) {
   echo('DRAW_EVOLUTE_FOR_PATH');


   var t;
   var bx, by;
   var dots = [];
   var evo_dots = [];
   var curv_dots = [];
   var curv_graph_dots = [[0, 0]];


   var total_path_length = 0;
   var current_sector_length = 0;
   // var curv_graph_dots = [];



   // var ss = doc.layers.getByName('Isolation Mode');
   // alert(ss.name);

   // var nn = ss.layers[0].layers.add();

   //create a test layer, where the profile will be drawn, if it does not already exist
   try {
      tmp_layer = doc.layers.getByName('corner_smoothing_script_tmp_layer');
   } catch (e) {

      //if we can`t find tmp layer, trying to create it
      try {
         tmp_layer = doc.layers.add();   

      }  catch (e) {
         //if we can`t create tmp layer, we are most likely in isolation mode

         try {
            //isolation mode in layer
            tmp_layer = doc.layers.getByName('Isolation Mode').layers[0].groupItems.add();
         }  catch (e) {
            //isolation mode in group
            tmp_layer = doc.layers.getByName('Isolation Mode').groupItems[0].groupItems.add();
         }


      }

      tmp_layer.name = 'corner_smoothing_script_tmp_layer';
   }



   var test_group = tmp_layer.groupItems.add();

   test_group.opacity = 40;

   var curv_path = create_empty_curv_path(test_group, true);
   curv_path.name = 'start_path';

   var path_for_length_measuring = create_empty_curv_path(test_group, false);
   path_for_length_measuring.name = 'path_for_length_measuring';


   var stroke_offset = 0;
   if (opath.stroked) {
      stroke_offset = opath.strokeWidth / 2;
   }

   //TODO: understand
   stroke_offset = 0;//doesn't work yet
   echo('stroke: ' + stroke_offset);

   echo(opath.pathPoints.length + ' points');

   var curv_path_start_point_index = 0;


   var to_l = opath.pathPoints.length - 1;

   /* if path is closed, return to the zero point at the end of loop */
   if (opath.closed) {
      to_l++;
   }

   /* loop for points of path */
   for (var j = 0; j < to_l; j++) {

      echo(' ');
      echo(' ');

      //current point index
      var from_index = j;

      //next point index (assuming that after last will zero again)
      var to_index = (j + 1) % opath.pathPoints.length;

      echo('from point ' + from_index + ' to ' + to_index + ' (' + (j + 1) + ')');

      var p_cur = opath.pathPoints[from_index];

      var P0 = p_cur.anchor;
      var P1 = p_cur.rightDirection;

      var p_next = opath.pathPoints[to_index];

      var P2 = p_next.leftDirection;
      var P3 = p_next.anchor;

      if (j == 0) {
         copy_point_to_path(p_cur, path_for_length_measuring);
      }

      copy_point_to_path(p_next, path_for_length_measuring);

      echo('total_length: ' + total_path_length + ' -> ' + path_for_length_measuring.length);

      //how much longer
      current_sector_length = path_for_length_measuring.length - total_path_length;

      //redefining
      total_path_length = path_for_length_measuring.length;

      echo('sector_length = ' + current_sector_length);
      echo('true total_length = ' + opath.length);

      echo('P0 ' + P0);
      echo('P1 ' + P1);
      echo('P2 ' + P2);
      echo('P3 ' + P3);

      if (P0[0] == P1[0] &&
         P0[1] == P1[1] &&
         P2[0] == P3[0] &&
         P2[1] == P3[1]) {

         echo('straight part');

         //add points of original path to profile
         reverse_points_adding(opath, curv_path_start_point_index, from_index, curv_path, stroke_offset);

         //put it back
         if (curv_path.pathPoints.length > 0) {

            echo('creating new curv_path');
            curv_path = create_empty_curv_path(test_group, true);
            curv_path.name = 'from ' + j + ' path';

         }

         curv_path_start_point_index = j + 1;

         curv_dots.push([P0[0], P0[1]], [P3[0], P3[1]]);

         continue;
      }



      /* 
        there are four points:
        P0 [x,y] — start point
        P1 [x,y] - handle extending from it
        P2 [x,y] – handle extending from second point
        P3 [x,y] - second point
  
        B = (1-t)***3 * P0  +  3*t*(1-t)**2 * P1  +  3*t*t*(1-t) * P2  +  t***3 * P3;
  
        t - in length from 0 to 1
       */

      var steps = 50;


      for (var i = 0; i <= steps; i++) {
         // echo(' ');

         t = i / steps; //from 0 to 1

         bx = coord_from_t(P0[0], P1[0], P2[0], P3[0], t);
         by = coord_from_t(P0[1], P1[1], P2[1], P3[1], t);
         dots.push([bx, by]);

         var evolute_d = evolute(P0[0], P1[0], P2[0], P3[0], P0[1], P1[1], P2[1], P3[1], t, current_sector_length, opath.length, stroke_offset, opath);

         if (evolute_d != undefined) {

            evo_dots.push(evolute_d[0]);
            curv_dots.push(evolute_d[1]);
            curv_graph_dots.push(evolute_d[2]);

            var pp = curv_path.pathPoints.add();
            pp.anchor = evolute_d[1];
            pp.leftDirection = pp.anchor;
            pp.rightDirection = pp.anchor;
            // echo('adding point to curv_path '+evolute_d[1][0]+' '+evolute_d[1][1]);

         }



      }


   }

   echo('draw paths');
   path_for_length_measuring.remove();

   reverse_points_adding(opath, curv_path_start_point_index, j, curv_path, stroke_offset);

   // echo('so length of curv_path is '+);

   if (curv_path.pathPoints.length == 0) {
      echo('path is empty, delete');
      curv_path.remove();
   }


   if (curv_dots.length > 0) {


   } else {
      echo('SORRY, NO POINTS – NO CURV PATH');
   }



}





function create_empty_curv_path(where, clsed) {

   var newPath;
   if (where) {
      newPath = where.pathItems.add();
   } else {
      newPath = tmp_layer.pathItems.add();
   }


   newPath.name = 'curiate';
   newPath.filled = true;
   newPath.stroked = false;
   newPath.fillColor = curviture_color;
   newPath.closed = clsed;

   return newPath;
}



function copy_point_to_path(p1, to) {

   var pp1 = to.pathPoints.add();
   pp1.anchor = p1.anchor;
   pp1.leftDirection = p1.leftDirection;
   pp1.rightDirection = p1.rightDirection;

}

function reverse_points_adding(path_from, point_from_i, point_to_i, path_to, stroke_offset) {
   echo('[reverse_points_adding] from ' + point_from_i + ' to ' + point_to_i + ' in path with length ' + path_from.pathPoints.length);


   var donor;
   var pp;


   if (point_from_i == point_to_i) {

      echo('same point. ignore');


      // return ;
   } else if (point_to_i == path_from.pathPoints.length) { //ending at the first point (end of the cycle)


      echo('case 1 (closed to the end)');

      donor = path_from.pathPoints[0];

      echo('>adding point ' + 0);

      pp = path_to.pathPoints.add();
      pp.anchor = donor.anchor;
      pp.leftDirection = donor.anchor;
      pp.rightDirection = donor.leftDirection;


      for (var i = path_from.pathPoints.length - 1; i >= point_from_i; i--) {
         echo('>adding point ' + i);

         donor = path_from.pathPoints[i];

         pp = path_to.pathPoints.add();
         pp.anchor = donor.anchor;
         pp.leftDirection = donor.rightDirection;
         pp.rightDirection = donor.leftDirection;
         // echo('adding point to curv_path '+evolute_d[1][0]+' '+evolute_d[1][1]);

         if (i == point_from_i) {
            pp.rightDirection = donor.anchor;
         }

      }


      /*
          echo('case 3');
      
          var donor = path_from.pathPoints[point_to_i];
          echo('>adding point '+point_to_i);
      
          var pp = path_to.pathPoints.add();
          pp.anchor = donor.anchor;
          pp.leftDirection = donor.anchor;
          pp.rightDirection = donor.leftDirection;    
      
          var donor = path_from.pathPoints[point_from_i];
          echo('>adding point '+point_from_i);
      
          var pp = path_to.pathPoints.add();
          pp.anchor = donor.anchor;
          pp.leftDirection = donor.rightDirection;
          pp.rightDirection = donor.anchor; 
      */



   } else if (point_from_i < point_to_i) {//normal case
      echo('case 2 (normal)');

      for (var i = point_to_i; i >= point_from_i; i--) {
         echo('>adding point ' + i);

         donor = path_from.pathPoints[i];

         pp = path_to.pathPoints.add();
         pp.anchor = donor.anchor;
         pp.leftDirection = donor.rightDirection;
         pp.rightDirection = donor.leftDirection;
         // echo('adding point to curv_path '+evolute_d[1][0]+' '+evolute_d[1][1]);

         if (i == point_from_i) {
            pp.rightDirection = donor.anchor;
         } else if (i == point_to_i) {
            pp.leftDirection = donor.anchor;
         }


      }

   } else { //The thing here is that we join to the starting point - from 12 to 0, for example
      echo('WTF');

   }

}

// https://en.wikipedia.org/wiki/Bezier_curve#Cubic_Bezier_curves
// cubic Bezier curve
function coord_from_t(p0, p1, p2, p3, t) {
   var by = (1 - t) * (1 - t) * (1 - t) * p0 + 3 * t * (1 - t) * (1 - t) * p1 + 3 * t * t * (1 - t) * p2 + t * t * t * p3;
   return by;
}


// derivative of the cubic Bezier curve with respect to t
function d_coord_from_t(p0, p1, p2, p3, t) {

   var d = 3 * (1 - t) * (1 - t) * (p1 - p0) + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (p3 - p2);

   echo("d't with t = " + t + ', p0 = ' + p0 + ', p1 = ' + p1 + ' is ' + d);

   return d;
}

//second derivative of the Bezier curve with respect to t
function dd_coord_from_t(p0, p1, p2, p3, t) {

   var dd = 6 * (1 - t) * (p2 - 2 * p1 + p0) + 6 * t * (p3 - 2 * p2 + p1);

   return dd;
}



function evolute(p0x, p1x, p2x, p3x, p0y, p1y, p2y, p3y, t, current_sector_length, total_length, stroke_offset, ppath) {
   // echo('evolute ');

   var evo_x = 0;
   var evo_y = 0;
   var curv_x = 0;
   var curv_y = 0;

   var x = coord_from_t(p0x, p1x, p2x, p3x, t);     //x
   var y = coord_from_t(p0y, p1y, p2y, p3y, t);     //y

   var dx_t = d_coord_from_t(p0x, p1x, p2x, p3x, t); //x'
   var dy_t = d_coord_from_t(p0y, p1y, p2y, p3y, t); //y'

   var ddx_t = dd_coord_from_t(p0x, p1x, p2x, p3x, t); //x''
   var ddy_t = dd_coord_from_t(p0y, p1y, p2y, p3y, t); //y''

   var limit = 0.000001;


   if (Math.abs(dx_t * dx_t + dy_t * dy_t) < limit) {

      echo('dividing by zero2');
      return undefined;
   }

   var top_part = dx_t * ddy_t - ddx_t * dy_t;
   var normal_sq_len = dx_t * dx_t + dy_t * dy_t;
   var normal_len = Math.sqrt(normal_sq_len);


   echo(top_part);


   //curvature at the point https://en.wikipedia.org/wiki/Curvature
   //https://pomax.github.io/bezierinfo/ (Curve inflections) here they say that the curvature is only the numerator of the design below
   var curv = top_part / (Math.pow(normal_len, 3));
   //canonical curvature. when reduced by a factor of two, the curvature increases by a factor of four

   // how to show it?
   var version = 3;

   switch (version) {

      //option 3: the opposite - increase the curvature in proportion to the normal. scalability is ok, otherwise it's a dilemma
      case 3:
         curv_x = x + 0.1 * curv * dy_t * normal_len;
         curv_y = y - 0.1 * curv * dx_t * normal_len;
         break;
      // the rate of change of curvature with respect to the scale is exactly equal to the curvature


      // option 5: without normalization, but with multiplication by segment length 
      // if(dy_t > 0) var dy_sign; 
      case 5:
         curv_x = x /*- stroke_offset*Math.sign(dy_t)*/ + curv * dy_t * current_sector_length / 25;
         curv_y = y /*+ stroke_offset*Math.sign(dx_t)*/ - curv * dx_t * current_sector_length / 25;
         break;

   }



   return [[evo_x, evo_y], [curv_x, curv_y], [t, Math.abs(curv)]];

   // var X
}




































// UI FUNCTIONS



//OK button processing
function actionOK() {

   echo('actionOK');

   tmp_layer.remove();

   settings.close();

}

//Cancel button processing
function actionCanceled() {


   // Undo the changes and close the panel
   echo('onClose');
   app.undo();
   app.redraw();
   settings.close();


}




// Update parameters in the panel
function settings_updated() {

   echo('settings_updated');
   app.undo();

   restore_points_selection();
   go();

   app.redraw();

}





// Creating a panel with settings
function build_ui() {


   var dark_theme = false;


   // DIALOG
   // ======
   var win = new Window("dialog", undefined, undefined, { minimizeButton: true });
   win.text = loc({'en':"Round Corner Customization", 'ru':"Настройка скругления углов"});
   win.orientation = "row";
   win.alignChildren = ["left", "top"];
   win.spacing = 0;
   win.margins = 0;



   var graphics = win.graphics;
   var col = graphics.newBrush(graphics.BrushType.THEME_COLOR, "background").color[0];

   if (col < 0.5) dark_theme = true;




   // LEFT SIZE 
   // ======
   var left_part = win.add("group", undefined, { name: "left_part" });
   left_part.preferredSize.width = 239;
   left_part.orientation = "column";
   left_part.alignChildren = ["fill", "top"];
   left_part.spacing = 0;
   left_part.margins = 16;







   // FIRST COEF
   // ======
   var coef1_ui = left_part.add("group", undefined, { name: "coef1_ui" });
   coef1_ui.orientation = "column";
   coef1_ui.alignChildren = ["left", "center"];
   coef1_ui.spacing = 0;
   coef1_ui.margins = [1, 10, 0, 1];

   // NAME AND INPUT
   // ======
   var coef1_name_and_input = coef1_ui.add("group", undefined, { name: "coef1_name_and_input" });
   coef1_name_and_input.orientation = "row";
   coef1_name_and_input.alignChildren = ["left", "center"];
   coef1_name_and_input.spacing = 10;
   coef1_name_and_input.margins = 0;
   coef1_name_and_input.alignment = ["fill", "center"];

   //NAME
   var coef1_n = coef1_name_and_input.add("statictext", undefined, undefined, { name: "coef1_n" });
   coef1_n.text = loc({'en':"Anchors coef", 'ru':"Смещение якорей"});
   coef1_n.preferredSize.width = 171;

   //INPUT
   var coef1_e = coef1_name_and_input.add('edittext {properties: {name: "coef1_e", borderless: true}}');
   coef1_e.text = coef1;
   coef1_e.preferredSize.width = 50;
   coef1_e.preferredSize.height = 22;

   // SLIDER
   // ======
   var coef1_slider = coef1_ui.add("slider", undefined, coef1, 0, max_coef1, { name: "coef1_slider" });
   coef1_slider.minvalue = 0;
   coef1_slider.maxvalue = max_coef1;
   coef1_slider.value = coef1;
   coef1_slider.alignment = ["fill", "center"];


   coef1_slider.onChanging = function () {
      coef1_e.text = roundOff(coef1_slider.value);
      if (!dropdown_reseted) reset_dropdown();
   };
   coef1_slider.onChange = function () {
      coef1 = coef1_e.text;
      // alert('3');
      update_prefs_from_vars();
      settings_updated();
   };
   coef1_e.onChanging = function () {
      coef1_slider.value = coef1_e.text;
      coef1 = coef1_e.text;
      // alert('4');
      update_prefs_from_vars();
      settings_updated();
   };






   // SECOND COEF
   // ======
   var coef2_ui = left_part.add("group", undefined, { name: "coef2_ui" });
   coef2_ui.orientation = "column";
   coef2_ui.alignChildren = ["left", "center"];
   coef2_ui.spacing = 0;
   coef2_ui.margins = [1, 10, 0, 1];


   // NAME AND INPUT
   // ======
   var coef2_name_and_input = coef2_ui.add("group", undefined, { name: "coef2_name_and_input" });
   coef2_name_and_input.orientation = "row";
   coef2_name_and_input.alignChildren = ["left", "center"];
   coef2_name_and_input.spacing = 10;
   coef2_name_and_input.margins = 0;
   coef2_name_and_input.alignment = ["fill", "center"];

   //NAME
   var coef2_n = coef2_name_and_input.add("statictext", undefined, undefined, { name: "coef1_n" });
   coef2_n.text = loc({'en':"Handles coef", 'ru':"Смещение усиков"});
   coef2_n.preferredSize.width = 171;

   //INPUT
   var coef2_e = coef2_name_and_input.add('edittext {properties: {name: "coef1_e", borderless: true}}');
   coef2_e.text = coef2;
   coef2_e.preferredSize.width = 50;
   coef2_e.preferredSize.height = 22;


   function reset_dropdown() {

      dropdown_reseted = true;

      del_preset_button.enabled = false;

      rebuild_dropdown();
   }

   function rebuild_dropdown() {
      echo('rebuild_dropdown');
      presets_vars_dropdown.removeAll();

      for (var i = 0; i < coefs.length; i++) {
         echo(coefs[i].name);
         presets_vars_dropdown.add("item", coefs[i].name);
      }


   }


   var dropdown_reseted = false;

   // SLIDER
   // ======
   var coef2_slider = coef2_ui.add("slider", undefined, coef2, 0, max_coef2, { name: "coef2_slider" });
   // coef2_slider.helpTip = "Handles coef"; 
   coef2_slider.minvalue = 0;
   coef2_slider.maxvalue = max_coef2;
   coef2_slider.value = coef2;
   coef2_slider.alignment = ["fill", "center"];

   coef2_slider.onChanging = function () {

      if (!dropdown_reseted) reset_dropdown();

      coef2_e.text = roundOff(coef2_slider.value);
   };

   coef2_slider.onChange = function () { /*set_param*/
      coef2 = coef2_e.text;
      // alert('5');
      update_prefs_from_vars();
      settings_updated();
   };
   coef2_e.onChanging = function () {
      coef2_slider.value = coef2_e.text; /*set_param*/
      coef2 = coef2_e.text;
      // alert('6');
      update_prefs_from_vars();
      settings_updated();
   };









   // PRESETS
   // ======

   var presets = left_part.add("group", undefined, { name: "presets" });
   presets.orientation = "row";
   presets.alignChildren = ["left", "bottom"];
   // presets.spacing = 10; 
   presets.spacing = 0;
   presets.margins = [0, 20, 0, 0];

   var presets_container = presets.add("group", undefined, { name: "presets_container" });
   presets_container.margins = [0, 0, 5, 0];

   //DROPDOWN LIST
   // var presets_vars = ["Default preset","small","pasha","verylongname"];
   var kys = [];

   var selection = null;
   for (var i = 0; i < coefs.length; i++) {
      // alert(coefs[i].name);
      kys.push(coefs[i].name);
      if (coefs[i].coef1 == coef1 && coefs[i].coef2 == coef2) {
         selection = i;
      }
   }

   // alert('3-2: '+kys.length);
   // alert(kys);

   var presets_vars_dropdown = presets_container.add("dropdownlist", undefined, undefined, { name: "presets_vars_dropdown", items: kys });


   //set not to zero, but to the one that matches the current values of coef1 and coef2 (if none, then the choice is empty)
   presets_vars_dropdown.selection = selection;
   presets_vars_dropdown.preferredSize.width = 185;

   presets_vars_dropdown.onChange = function () {

      if (presets_vars_dropdown.selection != null) {

         dropdown_reseted = false;

         coef1 = coefs[presets_vars_dropdown.selection.index].coef1; //anchor
         coef2 = coefs[presets_vars_dropdown.selection.index].coef2; //handle

         coef1_e.text = coef1;
         coef1_slider.value = coef1;

         coef2_e.text = coef2;
         coef2_slider.value = coef2;

         del_preset_button.enabled = true;

         update_prefs_from_vars();
         settings_updated();
      }

      /*set_param*/
   };



   //ADD BUTTON
   var icon_add_normal_str = "%C2%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%18%00%00%00%18%08%04%00%00%00J~%C3%B5s%00%00%00%C2%9EIDATx%C3%9A%C2%BD%C2%93%C2%BB%0A%C3%82%40%10E%2F%C3%98D2%C2%83%C2%85%C3%A0%C3%BFW%C2%96%C3%A27%C2%9C%C3%8A%C2%BF%C2%89%10%C2%AD%C3%87%22Q%12%C2%B3%C2%98%1DAg%C2%9Aeg%0Fw%5E%2BI%C2%A2%C3%851%1C%C3%87%5E%C3%AE%C2%93%C3%93%10i5%18g%C2%A2%C3%92O%C2%92%C2%B0%C3%AA%C3%A7AH%C3%82%09%C2%82%C3%83%5B%02%3EI%C3%A5%C3%A9%230(%C2%B8Vm%C2%AE%60%C3%B5%40Z%C2%A1%08%C3%90%C3%91%C2%B1%C3%BD%04%C3%982X%C2%BA%C3%BB%0A%C2%98%15M364%08%C3%B6%15%0A%C3%B4%C2%8Ba%5D%C2%B3%C3%80%C2%BD%C2%9C%C2%92%17j%C3%98a%18%C3%8D%C3%BF%C2%BBT%06n%C3%B4%C2%A9%C3%81%C2%AD%C2%AF%C2%86e%C2%B7%C3%95%7F%C2%A8%C2%90%C3%BE%C2%A2%1B.%C3%95%C3%80Qy%7B%00X%C3%9E%C2%9F%C2%8B%C2%94%C3%8D%14_%00%00%00%00IEND%C2%AEB%60%C2%82";

   var icon_add_hover_str = "%C2%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%18%00%00%00%18%08%04%00%00%00J~%C3%B5s%00%00%00%C2%98IDATx%C3%9A%C2%BDTI%0A%C2%800%0C%0CxQL%C3%B0%20%C3%B8%C3%BF%C2%93G%C3%B1%19%C3%BEFA%3D%C2%8F%C2%B4Up%09%C3%9A%C2%80%C2%9A%C2%81%12H%C2%86%C3%89%C3%92%C2%96%40%20%C3%A4%100%C3%84%C2%9F%1Bd%C3%A7%C2%85H%C3%AEr%5Dz%C2%8BXk%1C%C2%81a1%22%C2%88w%C2%AAS%01%C2%B2%2Be%C3%83J%08%C2%8E%C3%B8%5E%C3%AEqP%C3%A0x%C2%82YA'%C3%B4%C3%A8%C2%91%C3%9D%11X%09%C3%B2K%C2%84c%C3%93%C3%A9%3APge%C2%8C%C3%82xY%C3%95%60%25%C3%8CzI%C2%A2%C3%88%17~%C2%BF%C3%A9%C3%BFS%C3%92%09%13F%C3%9B%C3%A2%1E%C2%AF%06%5Bo%C2%AB%7C%C2%A8%60~%C2%A2%09%C2%BA%C3%A8%C3%B4%3A%C3%BC%1A%26%2CB2%03%C3%AB%1CO%15%C2%9E%00%00%00%00IEND%C2%AEB%60%C2%82";



   var icon_add_hover_light_theme_str = "%C2%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%18%00%00%00%18%08%04%00%00%00J~%C3%B5s%00%00%00%C2%94IDATx%C3%9A%C2%BDS%C2%BB%0A%C2%800%0C%3CpQLp%10%C3%BC%C3%BF%C3%89Q%C3%BC%0C%C3%BFF%C2%A1%3A%2B%C2%AD%15%7C%04M%40%C2%BD%40%09M%C2%8EK%C2%93%14%C3%B0%C3%88%C3%81%20p87%C3%A3%C2%9D%C2%B7FrD%C2%B4%C2%98%C2%95%C3%96%C3%B8tR%C2%A7%7B%03%C3%80%C3%81%C2%A9N%05%C3%B0%C2%AE%C2%94%C3%8D%22au%18%C3%8F8(%C2%90%C2%9E%60V%C2%90%09%3Dzdw%04%12%C2%82%C3%B4%12%C3%A1%C3%B8%C3%A846%C3%94%C3%9F%C2%95%1A%05w%19%C3%95%60%25LrI%2C%C3%88%17a%C2%BE%C3%A9%C3%BF%5D%C2%92%09%23%C2%9Cmp%C2%8F%C2%ABA%C3%96m%C3%A5%0F%15%C3%8C_4A%C2%A7N%C2%AFa%C3%87%02%01%09%C3%85%C3%BE%C3%9C%C3%AE%C3%93%C3%8D%00%00%00%00IEND%C2%AEB%60%C2%82";

   var icon_add_normal_light_theme_str = "%C2%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%18%00%00%00%18%08%04%00%00%00J~%C3%B5s%00%00%00%C2%9DIDATx%C3%9A%C2%BD%C2%93M%0A%C3%82%40%0CF%3FpSi%C2%82%0B%C3%81%C2%BB%C2%BC%0B%C2%BB%14%C2%8F%C3%A1m*T%C3%97q%C3%91*%C2%AD%1D%C3%ACD%C3%90d3L%C3%A6%C3%B1%C3%A5o%24I%C2%B48%C2%86%C3%A3%C3%98%C3%8B%7Dr%1A%22%C2%AD%06%C3%A3LT%C3%BAI%12V%C3%BD%3C%08I8ApxK%C3%80'%C2%A9%3C%7D%04%06%05%C3%97%C2%AA%C3%8D%15%C2%AC%1EH%2B%14%01%3A%3A%C2%B6%C2%9F%00%5B%06Kw_%01%C2%B3%C2%A2i%C3%86%C2%86%06%C3%81%C2%BEB%C2%81~1%C2%ACk%16%C2%B8%C2%97S%C3%B2B%0D%3B%0C%C2%A3%C3%B9%7F%C2%97%C3%8A%C3%80%C2%8D%3E5%C2%B8%C3%B5%C3%95%C2%B0%C3%AC%C2%B6%C3%BA%0F%15%C3%92_t%C3%83%C2%A5%1A8*o%0F%2B%C3%BE%05%C3%B4%C2%923%C3%A2%C2%8D%00%00%00%00IEND%C2%AEB%60%C2%82";




   var icon_add_normal = ScriptUI.newImage(File.decode(icon_add_normal_str));
   var icon_add_hover = ScriptUI.newImage(File.decode(icon_add_hover_str));

   var icon_add_normal_light_theme = ScriptUI.newImage(File.decode(icon_add_normal_light_theme_str));
   var icon_add_hover_light_theme = ScriptUI.newImage(File.decode(icon_add_hover_light_theme_str));

   var new_preset_button = presets.add("iconbutton", undefined, icon_add_normal, { name: "new_preset_button", style: "toolbutton" });
   new_preset_button.helpTip = loc({'en':"Save current values as new preset", 'ru':"Сохранить значения в пресет"});

   new_preset_button.onClick = function () {
      draw_save_preset_dialog();
   };

   new_preset_button.size = [22, 22];
   new_preset_button.fillBrush = new_preset_button.graphics.newBrush(new_preset_button.graphics.BrushType.SOLID_COLOR, [1, 1, 1, 0.1]);



   new_preset_button.onDraw = function (drState) {


      if (!this.image) return;

      var WH = this.size,
         wh = this.image.size,
         k = Math.min(WH[0] / wh[0], WH[1] / wh[1]),
         xy;

      var wh2 = [k * wh[0], k * wh[1]];
      xy = [(WH[0] - wh2[0]) / 2, (WH[1] - wh2[1]) / 2];



      if (drState.mouseOver) {
         this.graphics.drawOSControl();
         this.graphics.rectPath(0, 0, this.size[0], this.size[1]);
         this.graphics.fillPath(this.fillBrush);

         // this.graphics.drawImage(already, 0, xy[1], 12, 12);
         if (dark_theme) {
            this.graphics.drawImage(icon_add_hover, (WH[0] - wh[0] / 2) / 2, (WH[1] - wh[1] / 2) / 2, 12, 12);
         } else {
            this.graphics.drawImage(icon_add_hover_light_theme, (WH[0] - wh[0] / 2) / 2, (WH[1] - wh[1] / 2) / 2, 12, 12);
         }


      }
      else {
         // this.graphics.drawImage(this.image, 0, xy[1], 12, 12);
         if (dark_theme) {
            this.graphics.drawImage(this.image, (WH[0] - wh[0] / 2) / 2, (WH[1] - wh[1] / 2) / 2, 12, 12);
         } else {
            this.graphics.drawImage(icon_add_normal_light_theme, (WH[0] - wh[0] / 2) / 2, (WH[1] - wh[1] / 2) / 2, 12, 12);
         }
      }


      WH = wh = xy = null;


   };

   function draw_save_preset_dialog() {
      echo('draw_save_preset_dialog');
      // alert('so2')
      // DIALOG
      // ======
      var save_preset_dialog = new Window("dialog");
      save_preset_dialog.text = loc({'en':"New preset", 'ru':"Новый пресет"});
      save_preset_dialog.orientation = "column";
      save_preset_dialog.alignChildren = ["center", "top"];
      save_preset_dialog.spacing = 10;
      save_preset_dialog.margins = 16;

      var new_preset_label = save_preset_dialog.add("statictext", undefined, undefined, { name: "new_preset_label" });
      new_preset_label.text = loc({'en':"Name of new preset", 'ru':"Имя нового пресета"});
      new_preset_label.alignment = ["left", "top"];

      var new_preset_input = save_preset_dialog.add('edittext {properties: {name: "new_preset_input", borderless: true}}');
      new_preset_input.text = coef1 + " - " + coef2;
      new_preset_input.preferredSize.width = 200;
      new_preset_input.alignment = ["left", "top"];

      new_preset_input.active = true;

      // 
      // ======
      var dial2_ok_and_cancel = save_preset_dialog.add("group", undefined, { name: "dial2_ok_and_cancel" });
      dial2_ok_and_cancel.orientation = "row";
      dial2_ok_and_cancel.alignChildren = ["left", "center"];
      dial2_ok_and_cancel.spacing = 10;
      dial2_ok_and_cancel.margins = 0;
      dial2_ok_and_cancel.alignment = ["right", "top"];

      var dial2_cancel = dial2_ok_and_cancel.add("button", undefined, undefined, { name: "cancel" });
      dial2_cancel.text = loc({'en':"Cancel", 'ru':"Отмена"});

      var dial2_ok = dial2_ok_and_cancel.add("button", undefined, undefined, { name: "ok" });
      dial2_ok.text = loc({'en':"Save", 'ru':"Сохранить"});



      dial2_ok.onClick = function () {

         echo('save ' + new_preset_input.text + ' with values ' + coef1 + ' and ' + coef2);

         coefs.push({
            "name": new_preset_input.text,
            "coef1": coef1,
            "coef2": coef2
         });


         save_preset_dialog.hide();

         echo('now rebuild_dropdown');
         rebuild_dropdown();
         echo('select new');
         presets_vars_dropdown.selection = coefs.length - 1;
         presets_vars_dropdown.enabled = true;
         del_preset_button.enabled = true;

         update_prefs_from_vars();
         // settings_updated();





      };

      save_preset_dialog.show();

   }






   //DELETE BUTTON

   var icon_del_normal_str = "%C2%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%18%00%00%00%18%08%04%00%00%00J~%C3%B5s%00%00%00jIDATx%C3%9A%C3%AD%C2%94%C3%91%09%C2%800%0CD%C2%BBn%C3%9D%20%C2%8Ew%C3%A3%24CD%C2%A4%C2%B5j%C3%81%C2%8B%15%C2%BF%C3%84%C3%9CG%08%C3%A4%C3%A5%C3%BAq4%C2%A5%C2%AE%200x%C2%95B%12%2FH%5B%C3%9E4s%40%C3%A1%C2%98%C3%9A%C2%94W%17%0E8%C2%9C%C3%8D%C3%BB%C3%95%7B%C2%B2Q%40%C2%B95%7B%C3%9Ac%00Vl%C2%A1%5D%C2%BF%04%C2%82%C3%BE%03%C2%9F%01%C2%B4D%C3%B8%10%11%7B7%7CC%40%C2%A43%C2%90C%C2%A0~%0D%0B%5B%C3%B1%C2%A5%C3%B9%C2%83%C2%AE%C2%A2q%00%00%00%00IEND%C2%AEB%60%C2%82";

   var icon_del_hover_str = "%C2%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%18%00%00%00%18%08%06%00%00%00%C3%A0w%3D%C3%B8%00%00%00qIDATx%01%C3%AD%C2%96%01%0A%C2%800%08E%C2%BD%C3%AE%C2%BAA%1DY%0Fa%06%0B%40%C2%A2%C3%9F%C3%B8E%11%02%0F%10%C3%A1%C2%BF9%C2%86L%5C%041%07%16xB%7BON%C2%B8%14%C3%AE%C2%80%C2%85%11h%0F%C2%99%0Ezm%C2%9F%C2%84%11%C3%B8%06%C3%91%C3%8F'%C2%BD%15%7BZ%C2%A0%C3%81%C3%A8%C3%88%C3%A3W%C3%BA%C2%BA%C3%80%C3%92%2BQP%0F%0A%C3%B8%C2%BA%04%25(%C3%81%17%04%1A%18X%1D%06%04%7F%C3%9B%C2%A64%40%C3%90%C3%98%C3%B0%C3%BCAX%01%C3%8FO*%C3%AFm%C3%B7I6%00%00%00%00IEND%C2%AEB%60%C2%82";

   var icon_del_disabled_str = "%C2%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%18%00%00%00%18%08%04%00%00%00J~%C3%B5s%00%00%00hIDATx%C3%9A%C3%AD%C2%94%C2%B1%0E%C2%800%08D%C3%BB%C2%BBu%C2%BB%11%3F%19%3E%02%C2%87%C3%96Z%C2%9BxX%C3%A3d%C3%A4%06B%C3%82%03%C2%86%0B)%0D%01%C2%81%C3%81%C2%AB%14%C2%92x%40Z%C3%B3%C2%AE%C2%95%03%0A%C3%87%C3%92%C2%AA%0C%C2%87r%C3%80%C3%A1%C2%AC%3E%C2%A6%C3%9E%C2%93%C3%8D%02%C3%8AW%C2%B3%C3%93%1E%03%C2%B0%C2%B2%16%3A%C3%A4K%20%C3%88%3F%C3%B0%19%40%C2%8B%C2%85%3B%C2%8B%C3%98%C2%BB%C3%A6%C2%9B%02%22%C2%9D%C2%81%1C%02%C3%B55l4%0CX%C3%85%3B%C2%89%3C%24%00%00%00%00IEND%C2%AEB%60%C2%82";

   var icon_del_disabled_light_theme_str = "%C2%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%18%00%00%00%18%08%04%00%00%00J~%C3%B5s%00%00%00jIDATx%C3%9A%C3%AD%C2%94%C3%91%09%C2%800%0CD%C2%BBn%C3%9D%20.r%3B%26CD%C2%A4%C2%B5j%C3%81%C2%8B%15%C2%BF%C3%84%C3%9CG%08%C3%A4%C3%A5%C3%BAq4%C2%A5%C2%AE%200x%C2%95B%12%2FH%5B%C3%9E4s%40%C3%A1%C2%98%C3%9A%C2%94W%17%0E8%C2%9C%C3%8D%C3%BB%C3%95%7B%C2%B2Q%40%C2%B95%7B%C3%9Ac%00Vl%C2%A1%5D%C2%BF%04%C2%82%C3%BE%03%C2%9F%01%C2%B4D%C3%B8%10%11%7B7%7CC%40%C2%A43%C2%90C%C2%A0~%0D%0Bo%C3%97%7C%C3%BD%C2%93%C3%BALv%00%00%00%00IEND%C2%AEB%60%C2%82";

   var icon_del_normal_light_theme_str = "%C2%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%18%00%00%00%18%08%04%00%00%00J~%C3%B5s%00%00%00jIDATx%C3%9A%C3%AD%C2%94%C3%91%09%C2%800%0CD%3B%C3%96%C2%ADT7%C2%88%23'CD%C2%A4%C2%B5j%C3%81%C2%8B%15%C2%BF%C3%84%C3%9CG%08%C3%A4%C3%A5%C3%BAq4%C2%A5%C2%AE%200x%C2%95B%12%2FH%5B%C3%9E4s%40%C3%A1%C2%98%C3%9A%C2%94W%17%0E8%C2%9C%C3%8D%C3%BB%C3%95%7B%C2%B2Q%40%C2%B95%7B%C3%9Ac%00Vl%C2%A1%5D%C2%BF%04%C2%82%C3%BE%03%C2%9F%01%C2%B4D%C3%B8%10%11%7B7%7CC%40%C2%A43%C2%90C%C2%A0~%0D%0BZT%22q%5B%1F%C3%86%0A%00%00%00%00IEND%C2%AEB%60%C2%82";

   var icon_del_hover = ScriptUI.newImage(File.decode(icon_del_hover_str));
   var icon_del_normal = ScriptUI.newImage(File.decode(icon_del_normal_str));
   var icon_del_disabled = ScriptUI.newImage(File.decode(icon_del_disabled_str));
   var icon_del_normal_light_theme = ScriptUI.newImage(File.decode(icon_del_normal_light_theme_str));
   var icon_del_disabled_light_theme = ScriptUI.newImage(File.decode(icon_del_disabled_light_theme_str));




   var del_preset_button = presets.add("iconbutton", undefined, icon_del_normal, { name: "del_preset_button", style: "toolbutton" });

   del_preset_button.helpTip = loc({'en':"Delete current preset", 'ru':"Удалить текущий пресет"});

   del_preset_button.size = [22, 22];
   // del_preset_button.enabled = false;

   del_preset_button.onClick = function () {

      // alert('4: '+coefs.length);
      coefs.splice(presets_vars_dropdown.selection.index, 1);



      rebuild_dropdown();

      if (coefs.length > 0) {

         presets_vars_dropdown.selection = 0;
         presets_vars_dropdown.active = true;

      } else {
         presets_vars_dropdown.enabled = false;
         del_preset_button.enabled = false;
      }

   };

   del_preset_button.fillBrush = del_preset_button.graphics.newBrush(del_preset_button.graphics.BrushType.SOLID_COLOR, [1, 1, 1, 0.1]);

   del_preset_button.onDraw = function (drState) {

      if (!this.image) return;

      var WH = this.size,
         wh = this.image.size,
         // k = Math.min(WH[0]/wh[0], WH[1]/wh[1]),
         xy;

      // var wh2 = [k*wh[0],k*wh[1]];
      // var xy2 = [ (WH[0]-wh2[0])/2, (WH[1]-wh2[1])/2 ];
      xy = [(WH[0] - wh[0] / 2) / 2, (WH[1] - wh[1] / 2 - 1) / 2];


      if (!del_preset_button.enabled) {
         if (dark_theme) {
            this.graphics.drawImage(icon_del_disabled, xy[0], xy[1], 12, 12);
         } else {
            this.graphics.drawImage(icon_del_disabled_light_theme, xy[0], xy[1], 12, 12);
         }
      } else if (drState.mouseOver) {
         this.graphics.drawOSControl();
         this.graphics.rectPath(0, 0, this.size[0], this.size[1]);
         this.graphics.fillPath(this.fillBrush);
         this.graphics.drawImage(icon_del_hover, xy[0], xy[1], 12, 12);
      }
      else {
         if (dark_theme) {
            this.graphics.drawImage(this.image, xy[0], xy[1], 12, 12);
         } else {
            this.graphics.drawImage(icon_del_normal_light_theme, xy[0], xy[1], 12, 12);
         }
      }



      WH = wh = xy = null;
   };






   //OPENING OPTIONS
   var group9 = left_part.add("group", undefined, { name: "group9" });
   group9.orientation = "column";
   group9.alignChildren = ["left", "center"];
   group9.spacing = 0;
   group9.margins = [0, 20, 10, 0];


   var profile = group9.add("checkbox", undefined, undefined, { name: "profile" });
   profile.text = loc({'en':"Show curvature profile", 'ru':"Показывать профиль кривизны"});
   // silent.text = "Silent running please";
   // silent.preferredSize.width = 221; 
   // profile.helpTip = "Silent running with last selected parameters.\nTo view this dialog again run the script with the Shift key pressed.";

   profile.value = show_profile;

   profile.onClick = function () {
      echo('SET show_profile TO ' + profile.value);
      show_profile = profile.value;

      // update_prefs_from_vars();
      settings_updated();

      var prof = show_profile ? 6 : 2;
      echo('set show_profile to ' + prof);
      app.preferences.setIntegerPreference('corner_smoothing_script_show_profile', prof);


   };






   var silent = group9.add("checkbox", undefined, undefined, { name: "silent" });
   // silent.text = "Show this dialog only when running the script with the Shift key pressed";
   silent.text = loc({'en':"Don't show this dialog again", 'ru':"Не показывать больше это окно"});
   // silent.text = "Silent running please";
   // silent.preferredSize.width = 221; 
   // silent.helpTip = "Show this dialog only when running \nthe script with the Shift key pressed";
   silent.helpTip = loc({'en':"Silent running with last selected parameters.\nTo view this dialog again run the script with the Shift key pressed.", 'ru':"Тихий запуск с использованием последних установленных параметров.\nДля показа окна настроек вновь надо будет запустить скрипт с зажатым шифтом"});

   silent.value = !ui;

   silent.onClick = function () {
      echo('SET UI TO ' + !silent.value);
      ui = !silent.value;

      var uii = ui ? 6 : 2;
      echo('set ui to ' + uii);
      app.preferences.setIntegerPreference('corner_smoothing_script_show_ui', uii);

   };













   // RIGHT SIDE
   // =======
   var ok_and_cancel = win.add("group", undefined, { name: "ok_and_cancel" });
   ok_and_cancel.orientation = "column";
   ok_and_cancel.alignChildren = ["fill", "top"];
   ok_and_cancel.spacing = 6;
   ok_and_cancel.margins = [0, 22, 16, 16];

   var ok = ok_and_cancel.add("button", undefined, undefined, { name: "ok" });
   ok.text = "OK";

   var cancel = ok_and_cancel.add("button", undefined, undefined, { name: "cancel" });
   cancel.text = loc({'en':"Cancel", 'ru':"Отмена"});

   cancel.onClick = actionCanceled;
   ok.onClick = actionOK;


   return win;
}

































// LET`S GO

// Create a log file
if (debug_mode) {
   //TODO: Windows support
   var logFile = "~/Desktop/corner_smoothig_log.txt";
   var log_file = new File(logFile);
   log_file.open("w");
   log_file.encoding = 'UTF-8';
}





echo('start!');
echo(app.locale);


// factory_reset();
init_configs();

// the script was run with the shift key pressed?
if (ScriptUI.environment.keyboardState.shiftKey) {
   // ui = !ui;
   shifted = true;
}



var settings = build_ui();

//Start with the standard parameters
var so = go();
if (so) {

   app.redraw();

   // show the settings panel
   if ((ui && !shifted) || (!ui && shifted))
      settings.show();

}



if (debug_mode) {
   log_file.close();
}
