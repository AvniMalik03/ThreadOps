const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const departmentsToSeed = [
  { name: 'Cutting', pin: '1111' },
  { name: 'Stitching', pin: '2222' },
  { name: 'Finishing', pin: '3333' },
  { name: 'Ironing', pin: '4444' },
  { name: 'Packing', pin: '5555' },
  { name: 'Dispatch', pin: '6666' },
  { name: 'QC', pin: '7777' }
];

async function seedDepartments() {
  // First delete the TestQC
  await supabase.from('departments').delete().eq('name', 'TestQC');
  
  // Insert the required departments
  for (const dept of departmentsToSeed) {
    const { error } = await supabase.from('departments').insert(dept);
    if (error && error.code !== '23505') { // Ignore unique constraint errors
      console.error(`Error inserting ${dept.name}:`, error);
    }
  }
  
  const { data } = await supabase.from('departments').select('*');
  console.log("Current departments in DB:");
  console.log(JSON.stringify(data, null, 2));
}

seedDepartments();
