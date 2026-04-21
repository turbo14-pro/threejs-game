import bpy
import os
import sys
import argparse

# Clear existing objects in Temp collection if any
def setup_collections():
    for name in ["Temp", "Actions"]:
        if name not in bpy.data.collections:
            new_col = bpy.data.collections.new(name)
            bpy.context.scene.collection.children.link(new_col)
    return bpy.data.collections["Temp"], bpy.data.collections["Actions"]

def clean_temp_collection(temp_col):
    for obj in temp_col.objects:
        bpy.data.objects.remove(obj, do_unlink=True)

def process_mixamo(fbx_path, output_dir, action_name=None):
    temp_col, actions_col = setup_collections()
    clean_temp_collection(temp_col)
    
    filename = os.path.basename(fbx_path)
    base_name = os.path.splitext(filename)[0]
    final_action_name = action_name if action_name else base_name
    unique_id = os.urandom(4).hex()
    
    # 1. Import FBX
    bpy.ops.import_scene.fbx(filepath=fbx_path)
    
    # Move imported objects to Temp
    imported_objs = [obj for obj in bpy.context.selected_objects]
    for obj in imported_objs:
        for col in obj.users_collection:
            col.objects.unlink(obj)
        temp_col.objects.link(obj)
    
    # 2. Delete meshes from imported armature
    imported_armature = None
    for obj in imported_objs:
        if obj.type == 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
        elif obj.type == 'ARMATURE':
            imported_armature = obj
            
    if not imported_armature:
        print("Error: No armature found in FBX")
        return
        
    # 3. Rename action and push to NLA
    if imported_armature.animation_data and imported_armature.animation_data.action:
        mixamo_action = imported_armature.animation_data.action
        mixamo_action.name = f"mixamo.{base_name}.{unique_id}"
        
        # Calculate duration
        frame_end = int(mixamo_action.frame_range[1])
        
        # Push down to NLA
        bpy.context.view_layer.objects.active = imported_armature
        bpy.ops.nla.action_push_down(channel_index=0)
    else:
        print("Error: No action found on imported armature")
        return

    # 4. Transfer to MixamoBase
    mixamo_base = bpy.data.objects.get("MixamoBase")
    if not mixamo_base:
        print("Error: MixamoBase not found in scene")
        return
        
    # Clear NLA on MixamoBase
    if mixamo_base.animation_data:
        for track in mixamo_base.animation_data.nla_tracks:
            mixamo_base.animation_data.nla_tracks.remove(track)
            
    # Link new action to MixamoBase
    if not mixamo_base.animation_data:
        mixamo_base.animation_data_create()
    
    # Create NLA track and add strip
    new_track = mixamo_base.animation_data.nla_tracks.new()
    new_track.name = "MixamoImport"
    new_track.strips.new(mixamo_action.name, 1, mixamo_action)
    
    # User said: "push action down to the top of the NLA stack"
    # Link the new NLA strip we created into the action slot of mixamoBase
    mixamo_base.animation_data.action = mixamo_action

    # 5. Duplicate CharacterBase and Bake
    char_base = bpy.data.objects.get("CharacterBase")
    if not char_base:
        print("Error: CharacterBase not found in scene")
        return
        
    # Select CharacterBase and duplicate
    bpy.ops.object.select_all(action='DESELECT')
    char_base.select_set(True)
    bpy.context.view_layer.objects.active = char_base
    bpy.ops.object.duplicate()
    char_baked = bpy.context.active_object
    char_baked.name = f"BAKED_{base_name}"
    
    # Move to Temp
    for col in char_baked.users_collection:
        col.objects.unlink(char_baked)
    temp_col.objects.link(char_baked)
    
    # Pose mode and Bake
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    
    # Bake Action
    bpy.ops.nla.bake(
        frame_start=1,
        frame_end=frame_end,
        step=2,
        only_selected=True,
        visual_keying=True,
        clear_constraints=True,
        clear_parents=True,
        use_new_action=True,
        bake_types={'POSE'}
    )
    
    # 6. Post-Bake cleanup
    baked_action = char_baked.animation_data.action
    baked_action.name = final_action_name
    bpy.ops.nla.action_push_down(channel_index=0)
    
    # 7. Export GLTF
    export_path = os.path.join(output_dir, f"{final_action_name}.gltf")
    
    # Select ONLY the baked armature for export
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    char_baked.select_set(True)
    bpy.context.view_layer.objects.active = char_baked
    
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLTF_SEPARATE',
        export_texture_dir='textures',
        use_selection=True,
        export_yup=True,
        export_rest_position_armature=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=True,
        export_optimize_animation_keep_anim_object=True
    )
    
    # 8. Final move
    char_baked.name = final_action_name
    for col in char_baked.users_collection:
        col.objects.unlink(char_baked)
    actions_col.objects.link(char_baked)
    
    print(f"Successfully processed {filename} -> {export_path}")

if __name__ == "__main__":
    # Get arguments after "--"
    if "--" in sys.argv:
        args_idx = sys.argv.index("--") + 1
        parser = argparse.ArgumentParser()
        parser.add_argument("--fbx", required=True)
        parser.add_argument("--output", required=True)
        parser.add_argument("--name", default=None)
        args = parser.parse_args(sys.argv[args_idx:])
        
        process_mixamo(args.fbx, args.output, args.name)
    else:
        print("Error: Missing arguments. Use -- --fbx <path> --output <path>")
