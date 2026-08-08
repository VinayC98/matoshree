import { useQuery, useMutation } from "@tanstack/react-query";
import { getStudentsByLimit, createStudent } from "../api/students.api";
import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 10;

export default function Students() {
  const navigate = useNavigate();

  /* --------------------
     LOCAL STATE
  -------------------- */
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  /* --------------------
     DATA FETCH
     Fetch more than 10 so pagination works
  -------------------- */
  const {
    data = [],
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["students", "latest"],
    queryFn: () => getStudentsByLimit({ page, limit: PAGE_SIZE }), // 👈 fetch more
  });

  /* --------------------
     CREATE STUDENT
  -------------------- */
  const mutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      toast.success("Student added successfully!");
      setName("");
      setMobile("");
      refetch();
    },
    onError: (error: any) => {
      if (error.response?.status === 409) {
        toast.error("Student with this mobile already exists");
      } else {
        toast.error("Failed to add student");
      }
    },
  });

  /* --------------------
     FILTER + PAGINATION
  -------------------- */
  const filteredStudents = useMemo(() => {
    if (!search) return data;

    const q = search.toLowerCase();
    return data.filter(
      (s: any) => s.name.toLowerCase().includes(q) || s.mobile.includes(q),
    );
  }, [data, search]);

  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, page]);

  /* Reset page when filter changes */
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  if (isLoading) return <p>Loading students...</p>;
  console.log(data, "data");
  /* --------------------
     RENDER
  -------------------- */
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Students</h1>

      {/* ADD STUDENT */}
      <form
        className="bg-white p-4 rounded-lg shadow-sm flex gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ name, mobile });
        }}
      >
        <input
          className="border p-2 rounded w-1/3"
          placeholder="Student Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          className="border p-2 rounded w-1/3"
          placeholder="Mobile Number"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          required
        />

        <button
          className="bg-blue-800 text-white px-4 rounded disabled:opacity-50"
          disabled={mutation.isPending}
        >
          Add Student
        </button>
      </form>

      {/* SEARCH */}
      <div className="flex justify-between items-center">
        <input
          className="border p-2 rounded w-1/3"
          placeholder="Search by name or mobile"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <p className="text-sm text-gray-500">
          Showing {paginatedStudents.length} of {filteredStudents.length}
        </p>
      </div>

      {/* TABLE */}
      <table className="w-full border bg-white">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">No</th>
            <th className="p-2">Name</th>
            <th className="p-2">Mobile</th>
            <th className="p-2">Membership</th>
            <th className="p-2">Seat</th>
            <th className="p-2">Valid Till</th>
            <th className="p-2">Actions</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>

        <tbody>
          {paginatedStudents.map((s: any, index: number) => (
            <tr key={s.id} className="border-t">
              <td className="p-2">{index + 1}</td>
              <td className="p-2">{s.name}</td>
              <td className="p-2">{s.mobile}</td>
              <td className="p-2">
                {s.activeMembership ? (
                  <div className="flex flex-col">
                    <span>
                      {s.activeMembership.planName} /{" "}
                      {s.activeMembership.shiftName}
                    </span>
                    {!s.seat && (
                      <span className="text-xs text-green-600">
                        Seat not assigned
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-red-600">Membership not available</span>
                )}
              </td>
              <td className="p-2">{s.seat ?? "—"}</td>
              <td className="p-2">
                {s.activeMembership?.endDate
                  ? new Date(s.activeMembership.endDate).toLocaleString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )
                  : "—"}
              </td>

              <td className="p-2 flex gap-2">
                <button
                  onClick={() => navigate(`/seat-map?studentId=${s.id}`)}
                  disabled={!!s.seat}
                  className={`${
                    s.seat
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-blue-600 hover:underline"
                  }`}
                >
                  Assign Seat
                </button>
                <button
                  onClick={() => navigate(`/students/${s.id}`)}
                  className="text-yellow-600 hover:underline"
                >
                  View
                </button>
              </td>
              <td className="p-2">
                {s.activeMembership ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-red-600  cursor-not-allowed">
                    Inactive
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>

          <span className="text-sm">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
// import { useQuery, useMutation } from "@tanstack/react-query";
// import { getStudentsByLimit, createStudent } from "../api/students.api";
// import { useState, useMemo } from "react";
// import { toast } from "react-toastify";
// import { useNavigate } from "react-router-dom";

// const PAGE_SIZE = 10;

// export default function Students() {
//   const navigate = useNavigate();

//   const [name, setName] = useState("");
//   const [mobile, setMobile] = useState("");
//   const [search, setSearch] = useState("");
//   const [page, setPage] = useState(1);

//   const {
//     data = [],
//     refetch,
//     isLoading,
//   } = useQuery({
//     queryKey: ["students", page],
//     queryFn: () => getStudentsByLimit({ page, limit: PAGE_SIZE }),
//   });

//   const mutation = useMutation({
//     mutationFn: createStudent,
//     onSuccess: () => {
//       toast.success("Student added successfully");
//       setName("");
//       setMobile("");
//       refetch();
//     },
//     onError: (error: any) => {
//       if (error.response?.status === 409) {
//         toast.error("Student with this mobile already exists");
//       } else {
//         toast.error("Failed to add student");
//       }
//     },
//   });

//   const filteredStudents = useMemo(() => {
//     if (!search) return data;
//     const q = search.toLowerCase();
//     return data.filter(
//       (s: any) => s.name.toLowerCase().includes(q) || s.mobile.includes(q),
//     );
//   }, [data, search]);

//   const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);

//   const paginatedStudents = useMemo(() => {
//     const start = (page - 1) * PAGE_SIZE;
//     return filteredStudents.slice(start, start + PAGE_SIZE);
//   }, [filteredStudents, page]);

//   if (isLoading) return <p className="text-sm text-stone-500">Loading…</p>;

//   return (
//     <div className="w-full px-6 py-6">
//       <div className="mx-auto max-w-6xl space-y-6">
//         {/* HEADER */}
//         <h1 className="text-lg font-semibold text-stone-800">Students</h1>

//         {/* ADD STUDENT */}
//         <form
//           onSubmit={(e) => {
//             e.preventDefault();
//             mutation.mutate({ name, mobile });
//           }}
//           className="bg-stone-100/80 border border-stone-200 rounded-2xl p-5 shadow-sm flex gap-3 items-end"
//         >
//           <div className="flex-1">
//             <label className="text-xs text-stone-600">Student Name</label>
//             <input
//               className="w-full h-9 rounded-md border border-stone-300 bg-white px-3"
//               value={name}
//               onChange={(e) => setName(e.target.value)}
//               required
//             />
//           </div>

//           <div className="flex-1">
//             <label className="text-xs text-stone-600">Mobile</label>
//             <input
//               className="w-full h-9 rounded-md border border-stone-300 bg-white px-3"
//               value={mobile}
//               onChange={(e) => setMobile(e.target.value)}
//               required
//             />
//           </div>

//           <button
//             disabled={mutation.isPending}
//             className="h-9 px-5 rounded-md bg-amber-700 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
//           >
//             Add Student
//           </button>
//         </form>

//         {/* SEARCH */}
//         <div className="flex items-center justify-between">
//           <input
//             className="w-64 h-9 rounded-md border border-stone-300 bg-white px-3"
//             placeholder="Search by name or mobile"
//             value={search}
//             onChange={(e) => {
//               setSearch(e.target.value);
//               setPage(1);
//             }}
//           />

//           <span className="text-sm text-stone-500">
//             Showing {paginatedStudents.length} of {filteredStudents.length}
//           </span>
//         </div>

//         {/* TABLE */}
//         <div className="bg-stone-100/80 border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
//           <table className="w-full text-sm">
//             <thead className="bg-stone-200/60 text-stone-700">
//               <tr>
//                 <th className="p-3 text-left">Name</th>
//                 <th className="p-3 text-left">Mobile</th>
//                 <th className="p-3 text-left">Membership</th>
//                 <th className="p-3 text-left">Start</th>
//                 <th className="p-3 text-left">End</th>
//                 <th className="p-3 text-left">Seat</th>
//                 <th className="p-3 text-left">Status</th>
//                 <th className="p-3 text-left">Actions</th>
//               </tr>
//             </thead>

//             <tbody className="bg-white">
//               {paginatedStudents.map((s: any) => {
//                 const m = s.activeMembership;

//                 return (
//                   <tr
//                     key={s.id}
//                     className="border-t hover:bg-amber-50/40 transition"
//                   >
//                     <td className="p-3 font-medium text-stone-800">{s.name}</td>

//                     <td className="p-3 text-stone-600">{s.mobile}</td>

//                     <td className="p-3">
//                       {m ? (
//                         <span>
//                           {m.planName} / {m.shiftName}
//                         </span>
//                       ) : (
//                         <span className="text-red-600">No Membership</span>
//                       )}
//                     </td>

//                     <td className="p-3 text-stone-600">
//                       {m ? new Date(m.startDate).toLocaleDateString() : "—"}
//                     </td>

//                     <td className="p-3 text-stone-600">
//                       {m ? new Date(m.endDate).toLocaleDateString() : "—"}
//                     </td>

//                     <td className="p-3">{s.seat ?? "—"}</td>

//                     <td className="p-3">
//                       {m ? (
//                         <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">
//                           Active
//                         </span>
//                       ) : (
//                         <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">
//                           Inactive
//                         </span>
//                       )}
//                     </td>

//                     <td className="p-3 flex gap-3">
//                       <button
//                         onClick={() => navigate(`/seat-map?studentId=${s.id}`)}
//                         className="text-amber-700 hover:underline"
//                       >
//                         Assign Seat
//                       </button>

//                       <button
//                         onClick={() => navigate(`/students/${s.id}`)}
//                         className="text-emerald-700 hover:underline"
//                       >
//                         View
//                       </button>
//                     </td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </div>

//         {/* PAGINATION */}
//         {totalPages > 1 && (
//           <div className="flex justify-center items-center gap-4">
//             <button
//               disabled={page === 1}
//               onClick={() => setPage((p) => p - 1)}
//               className="h-8 px-3 border rounded-md disabled:opacity-50"
//             >
//               Prev
//             </button>

//             <span className="text-sm text-stone-600">
//               Page {page} of {totalPages}
//             </span>

//             <button
//               disabled={page === totalPages}
//               onClick={() => setPage((p) => p + 1)}
//               className="h-8 px-3 border rounded-md disabled:opacity-50"
//             >
//               Next
//             </button>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
