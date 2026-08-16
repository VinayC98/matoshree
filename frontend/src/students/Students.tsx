import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { createStudent, getStudentsByLimit } from "../api/students.api";

const PAGE_SIZE = 10;

type Student = {
  id: string;
  name: string;
  mobile: string;

  hasActiveMembership?: boolean;

  paymentStatus?: "YET_TO_PAY" | "PARTIAL" | "PAID";

  account?: {
    totalDue?: number;
    totalPaid?: number;
    outstanding?: number;
  };

  activeMembership?: {
    id: string;
    startDate?: string;
    endDate?: string;

    plan?: {
      id: string;
      code?: string;
      name?: string;
    };

    planId?: string;

    shift?: {
      id: string;
      code?: string;
      name?: string;
    };

    shiftId?: string;
  } | null;

  seat?: string | null;

  seatDetails?: {
    id?: string;
    seatNumber?: number;
    lab?: {
      id?: string;
      name?: string;
    };
    type?: "FIXED" | "DAILY" | string;
  } | null;
};

type Pagination = {
  total?: number;
  totalPages?: number;
  page?: number;
  limit?: number;
};

type ApiErrorShape = {
  response?: {
    status?: number;
  };
};

function isApiError(error: unknown): error is ApiErrorShape {
  return typeof error === "object" && error !== null;
}

export default function Students() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* =========================================================
     FORM
  ========================================================= */

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  /* =========================================================
     SEARCH
  ========================================================= */

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  /* =========================================================
     SEARCH DEBOUNCE
  ========================================================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  /* =========================================================
     QUERY
  ========================================================= */

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["students", page, search],
    queryFn: () =>
      getStudentsByLimit({
        page,
        limit: PAGE_SIZE,
        search,
      }),
    placeholderData: (previousData) => previousData,
  });

  const students: Student[] = Array.isArray(data?.data) ? data.data : [];

  const pagination: Pagination = data?.pagination ?? {};

  const total = Number(pagination.total ?? 0);

  const totalPages = Math.max(
    Number(pagination.totalPages ?? 0),
    total > 0 ? Math.ceil(total / PAGE_SIZE) : 0,
  );

  /* =========================================================
     CREATE STUDENT
  ========================================================= */

  const mutation = useMutation({
    mutationFn: createStudent,

    onSuccess: () => {
      toast.success("Student added successfully!");

      setName("");
      setMobile("");
      setPage(1);

      queryClient.invalidateQueries({
        queryKey: ["students"],
      });
    },

    onError: (error: unknown) => {
      if (isApiError(error) && error.response?.status === 409) {
        toast.error("Student with this mobile already exists");
      } else {
        toast.error("Failed to add student");
      }
    },
  });

  const handleCreateStudent = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedMobile = mobile.trim();

    if (!trimmedName) {
      toast.error("Enter student name");
      return;
    }

    if (!trimmedMobile) {
      toast.error("Enter mobile number");
      return;
    }

    mutation.mutate({
      name: trimmedName,
      mobile: trimmedMobile,
    });
  };

  /* =========================================================
     PAGINATION
  ========================================================= */

  const handlePrevious = () => {
    if (page <= 1 || isFetching) return;

    setPage((current) => current - 1);
  };

  const handleNext = () => {
    if (isFetching || !totalPages || page >= totalPages) {
      return;
    }

    setPage((current) => current + 1);
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (isLoading) {
    return (
      <div className="min-h-full bg-stone-50 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-7xl">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (isError) {
    return (
      <div className="min-h-full bg-stone-50 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-red-800">
                  Failed to load students
                </h2>

                <p className="mt-1 text-xs text-red-600">
                  Something went wrong while loading the student list.
                </p>
              </div>

              <button
                type="button"
                onClick={() => refetch()}
                className="
                  rounded-lg
                  border
                  border-red-200
                  bg-white
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-red-700
                  transition
                  hover:bg-red-50
                "
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="min-h-full bg-stone-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-800">Students</h1>

            <p className="mt-1 text-sm text-stone-500">
              Manage students, memberships, payments and seat assignments.
            </p>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500 shadow-sm">
            <span className="font-medium text-stone-700">{total}</span>{" "}
            {total === 1 ? "student" : "students"}
          </div>
        </div>

        {/* =====================================================
            ADD STUDENT
        ===================================================== */}

        <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-4 py-4 sm:px-5">
            <h2 className="text-sm font-semibold text-stone-800">
              Add Student
            </h2>

            <p className="mt-1 text-xs text-stone-500">
              Create a student profile using their name and mobile number.
            </p>
          </div>

          <form onSubmit={handleCreateStudent} className="p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              {/* NAME */}

              <div>
                <label
                  htmlFor="student-name"
                  className="mb-1.5 block text-xs font-medium text-stone-600"
                >
                  Student Name
                </label>

                <input
                  id="student-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter student name"
                  autoComplete="name"
                  required
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-stone-300
                    bg-white
                    px-3
                    text-sm
                    text-stone-800
                    outline-none
                    transition
                    placeholder:text-stone-400
                    focus:border-amber-600
                    focus:ring-2
                    focus:ring-amber-100
                  "
                />
              </div>

              {/* MOBILE */}

              <div>
                <label
                  htmlFor="student-mobile"
                  className="mb-1.5 block text-xs font-medium text-stone-600"
                >
                  Mobile Number
                </label>

                <input
                  id="student-mobile"
                  type="tel"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  placeholder="Enter mobile number"
                  autoComplete="tel"
                  required
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-stone-300
                    bg-white
                    px-3
                    text-sm
                    text-stone-800
                    outline-none
                    transition
                    placeholder:text-stone-400
                    focus:border-amber-600
                    focus:ring-2
                    focus:ring-amber-100
                  "
                />
              </div>

              {/* BUTTON */}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="
                  h-10
                  rounded-lg
                  bg-amber-700
                  px-5
                  text-sm
                  font-medium
                  text-white
                  transition
                  hover:bg-amber-800
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  md:min-w-[130px]
                "
              >
                {mutation.isPending ? "Adding..." : "Add Student"}
              </button>
            </div>
          </form>
        </section>

        {/* =====================================================
            SEARCH
        ===================================================== */}

        <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <SearchIcon />

              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or mobile"
                className="
                  h-10
                  w-full
                  rounded-lg
                  border
                  border-stone-300
                  bg-white
                  pl-10
                  pr-10
                  text-sm
                  text-stone-800
                  outline-none
                  transition
                  placeholder:text-stone-400
                  focus:border-amber-600
                  focus:ring-2
                  focus:ring-amber-100
                "
              />

              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setPage(1);
                  }}
                  className="
                    absolute
                    right-3
                    top-1/2
                    -translate-y-1/2
                    text-stone-400
                    hover:text-stone-700
                  "
                  aria-label="Clear search"
                >
                  <CloseIcon />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-stone-500 sm:justify-end">
              {isFetching && (
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-600" />
                  Updating
                </span>
              )}

              <span>
                Showing{" "}
                <strong className="font-medium text-stone-700">
                  {students.length}
                </strong>{" "}
                of{" "}
                <strong className="font-medium text-stone-700">{total}</strong>
              </span>
            </div>
          </div>
        </section>

        {/* =====================================================
            EMPTY
        ===================================================== */}

        {students.length === 0 ? (
          <EmptyStudentsState
            searching={Boolean(search)}
            onClearSearch={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
          />
        ) : (
          <>
            {/* =================================================
                DESKTOP TABLE
            ================================================= */}

            <section className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-left">
                      <th className="w-16 px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                        No.
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                        Student
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                        Mobile
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                        Membership
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                        Seat
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                        Valid Till
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                        Payment
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-stone-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((student, index) => (
                      <StudentTableRow
                        key={student.id}
                        student={student}
                        index={(page - 1) * PAGE_SIZE + index + 1}
                        onView={() => navigate(`/students/${student.id}`)}
                        onAssignSeat={() =>
                          navigate(`/seat-map?studentId=${student.id}`)
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* =================================================
                MOBILE / TABLET
            ================================================= */}

            <div className="grid grid-cols-1 gap-3 lg:hidden">
              {students.map((student, index) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  index={(page - 1) * PAGE_SIZE + index + 1}
                  onView={() => navigate(`/students/${student.id}`)}
                  onAssignSeat={() =>
                    navigate(`/seat-map?studentId=${student.id}`)
                  }
                />
              ))}
            </div>
          </>
        )}

        {/* =====================================================
            PAGINATION
        ===================================================== */}

        {totalPages > 1 && (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-stone-500">
                Page{" "}
                <strong className="font-medium text-stone-700">{page}</strong>{" "}
                of{" "}
                <strong className="font-medium text-stone-700">
                  {totalPages}
                </strong>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={page === 1 || isFetching}
                  onClick={handlePrevious}
                  className="
                    inline-flex
                    h-9
                    items-center
                    gap-1.5
                    rounded-lg
                    border
                    border-stone-300
                    bg-white
                    px-3
                    text-xs
                    font-medium
                    text-stone-600
                    transition
                    hover:bg-stone-50
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  <ChevronLeftIcon />
                  Previous
                </button>

                <button
                  type="button"
                  disabled={page === totalPages || isFetching}
                  onClick={handleNext}
                  className="
                    inline-flex
                    h-9
                    items-center
                    gap-1.5
                    rounded-lg
                    border
                    border-stone-300
                    bg-white
                    px-3
                    text-xs
                    font-medium
                    text-stone-600
                    transition
                    hover:bg-stone-50
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  Next
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   DESKTOP ROW
========================================================= */

function StudentTableRow({
  student,
  index,
  onView,
  onAssignSeat,
}: {
  student: Student;
  index: number;
  onView: () => void;
  onAssignSeat: () => void;
}) {
  const hasMembership =
    Boolean(student.activeMembership) || Boolean(student.hasActiveMembership);

  const hasSeat = Boolean(student.seat || student.seatDetails?.seatNumber);

  return (
    <tr className="border-b border-stone-100 last:border-0 hover:bg-stone-50/70">
      {/* NO */}

      <td className="px-4 py-4 text-xs text-stone-400">{index}</td>

      {/* STUDENT */}

      <td className="px-4 py-4">
        <button type="button" onClick={onView} className="group text-left">
          <div className="font-medium text-stone-800 transition group-hover:text-amber-700">
            {student.name}
          </div>

          <div className="mt-0.5 text-[11px] text-stone-400">
            View student profile
          </div>
        </button>
      </td>

      {/* MOBILE */}

      <td className="px-4 py-4 text-stone-600">{student.mobile}</td>

      {/* =====================================================
          MEMBERSHIP
      ===================================================== */}

      <td className="px-4 py-4">
        {hasMembership ? (
          <div className="space-y-1.5">
            {/* PLAN + ACTIVE */}

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-stone-800">
                {student.activeMembership?.plan?.name ?? "Active Membership"}
              </span>

              <span
                className="
                inline-flex
                items-center
                rounded-full
                border
                border-green-200
                bg-green-50
                px-2
                py-0.5
                text-[10px]
                font-medium
                text-green-700
              "
              >
                Active
              </span>
            </div>

            {/* SHIFT */}

            {student.activeMembership?.shift?.name ? (
              <span
                className="
                inline-flex
                items-center
                rounded-md
                border
                border-stone-200
                bg-stone-50
                px-2
                py-1
                text-[10px]
                font-medium
                text-stone-600
              "
              >
                {student.activeMembership.shift.name}
              </span>
            ) : (
              <span
                className="
                inline-flex
                items-center
                rounded-md
                border
                border-stone-200
                bg-stone-100
                px-2
                py-1
                text-[10px]
                font-medium
                text-stone-400
              "
              >
                Shift not set
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <span
              className="
              inline-flex
              items-center
              rounded-full
              border
              border-red-200
              bg-red-50
              px-2.5
              py-1
              text-[10px]
              font-medium
              text-red-700
            "
            >
              No active membership
            </span>

            <div className="text-[10px] text-stone-400">
              Membership required for seat assignment
            </div>
          </div>
        )}
      </td>

      {/* SEAT */}

      <td className="px-4 py-4">
        {hasSeat ? (
          <div>
            <div className="font-medium text-stone-700">
              {getSeatLabel(student)}
            </div>

            {student.seatDetails?.type && (
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-stone-400">
                {student.seatDetails.type}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-stone-400">Not assigned</span>
        )}
      </td>

      {/* VALID TILL */}

      <td className="px-4 py-4">
        <span className="text-xs text-stone-600">
          {student.activeMembership?.endDate
            ? formatDate(student.activeMembership.endDate)
            : "—"}
        </span>
      </td>

      {/* PAYMENT */}

      <td className="px-4 py-4">
        <PaymentStatus
          status={student.paymentStatus}
          outstanding={student.account?.outstanding}
        />
      </td>

      {/* ACTIONS */}

      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          {!hasSeat && hasMembership && (
            <button
              type="button"
              onClick={onAssignSeat}
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                border
                border-blue-200
                bg-blue-50
                px-3
                py-1.5
                text-xs
                font-medium
                text-blue-700
                transition
                hover:bg-blue-100
              "
            >
              <SeatIcon />
              Assign
            </button>
          )}

          <button
            type="button"
            onClick={onView}
            className="
              inline-flex
              items-center
              gap-1.5
              rounded-lg
              border
              border-stone-200
              bg-white
              px-3
              py-1.5
              text-xs
              font-medium
              text-stone-600
              transition
              hover:bg-stone-50
            "
          >
            View
            <ChevronRightIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* =========================================================
   MOBILE CARD
========================================================= */

function StudentCard({
  student,
  index,
  onView,
  onAssignSeat,
}: {
  student: Student;
  index: number;
  onView: () => void;
  onAssignSeat: () => void;
}) {
  const hasMembership =
    Boolean(student.activeMembership) || Boolean(student.hasActiveMembership);

  const hasSeat = Boolean(student.seat || student.seatDetails?.seatNumber);

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      {/* HEADER */}

      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onView} className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-stone-400">#{index}</span>

            <h2 className="truncate text-sm font-semibold text-stone-800">
              {student.name}
            </h2>
          </div>

          <p className="mt-1 text-xs text-stone-500">{student.mobile}</p>
        </button>

        <PaymentStatus
          status={student.paymentStatus}
          outstanding={student.account?.outstanding}
          compact
        />
      </div>

      {/* INFORMATION */}

      <div className="mt-4 rounded-lg border border-stone-100 bg-stone-50 p-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* MEMBERSHIP */}

          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
              Membership
            </div>

            {hasMembership ? (
              <div className="mt-1.5 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-stone-800">
                    {student.activeMembership?.plan?.name ??
                      "Active Membership"}
                  </span>

                  <span
                    className="
                    inline-flex
                    items-center
                    rounded-full
                    border
                    border-green-200
                    bg-green-50
                    px-2
                    py-0.5
                    text-[9px]
                    font-medium
                    text-green-700
                  "
                  >
                    Active
                  </span>
                </div>

                {student.activeMembership?.shift?.name ? (
                  <span
                    className="
                    inline-flex
                    items-center
                    rounded-md
                    border
                    border-stone-200
                    bg-white
                    px-2
                    py-1
                    text-[10px]
                    font-medium
                    text-stone-600
                  "
                  >
                    {student.activeMembership.shift.name}
                  </span>
                ) : (
                  <span
                    className="
                    inline-flex
                    items-center
                    rounded-md
                    border
                    border-stone-200
                    bg-stone-100
                    px-2
                    py-1
                    text-[10px]
                    font-medium
                    text-stone-400
                  "
                  >
                    Shift not set
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-1.5">
                <span
                  className="
                  inline-flex
                  items-center
                  rounded-full
                  border
                  border-red-200
                  bg-red-50
                  px-2.5
                  py-1
                  text-[10px]
                  font-medium
                  text-red-700
                "
                >
                  No active membership
                </span>
              </div>
            )}
          </div>

          {/* SEAT */}

          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
              Seat
            </div>

            <div className="mt-1 text-xs font-medium text-stone-700">
              {hasSeat ? getSeatLabel(student) : "Not assigned"}
            </div>

            {student.seatDetails?.type && (
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-stone-400">
                {student.seatDetails.type}
              </div>
            )}
          </div>

          {/* VALID TILL */}

          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
              Valid Till
            </div>

            <div className="mt-1 text-xs font-medium text-stone-700">
              {student.activeMembership?.endDate
                ? formatDate(student.activeMembership.endDate)
                : "—"}
            </div>
          </div>

          {/* OUTSTANDING */}

          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
              Outstanding
            </div>

            <div
              className={`mt-1 text-xs font-semibold ${
                Number(student.account?.outstanding ?? 0) > 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {formatCurrency(student.account?.outstanding)}
            </div>
          </div>
        </div>
      </div>

      {/* ACTIONS */}

      <div className="mt-4 flex gap-2">
        {!hasSeat && hasMembership && (
          <button
            type="button"
            onClick={onAssignSeat}
            className="
              inline-flex
              flex-1
              items-center
              justify-center
              gap-1.5
              rounded-lg
              border
              border-blue-200
              bg-blue-50
              px-3
              py-2
              text-xs
              font-medium
              text-blue-700
              transition
              hover:bg-blue-100
            "
          >
            <SeatIcon />
            Assign Seat
          </button>
        )}

        <button
          type="button"
          onClick={onView}
          className="
            inline-flex
            flex-1
            items-center
            justify-center
            gap-1.5
            rounded-lg
            border
            border-stone-200
            bg-white
            px-3
            py-2
            text-xs
            font-medium
            text-stone-600
            transition
            hover:bg-stone-50
          "
        >
          View Student
          <ChevronRightIcon />
        </button>
      </div>
    </article>
  );
}

/* =========================================================
   PAYMENT STATUS
========================================================= */

function PaymentStatus({
  status,
  outstanding,
  compact = false,
}: {
  status?: string;
  outstanding?: number;
  compact?: boolean;
}) {
  const normalizedStatus = status ?? "YET_TO_PAY";

  const config =
    normalizedStatus === "PAID"
      ? {
          label: "Paid",
          className: "border-green-200 bg-green-50 text-green-700",
        }
      : normalizedStatus === "PARTIAL"
        ? {
            label: "Partial",
            className: "border-amber-200 bg-amber-50 text-amber-700",
          }
        : {
            label: "Yet to Pay",
            className: "border-red-200 bg-red-50 text-red-700",
          };

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`
          inline-flex
          rounded-full
          border
          px-2.5
          py-1
          text-[10px]
          font-medium
          ${config.className}
        `}
      >
        {config.label}
      </span>

      {!compact && Number(outstanding ?? 0) > 0 && (
        <span className="text-[10px] text-stone-400">
          Due {formatCurrency(outstanding)}
        </span>
      )}
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyStudentsState({
  searching,
  onClearSearch,
}: {
  searching: boolean;
  onClearSearch: () => void;
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-500">
        <StudentIcon />
      </div>

      <h2 className="mt-4 text-sm font-semibold text-stone-800">
        {searching ? "No students found" : "No students yet"}
      </h2>

      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-stone-500">
        {searching
          ? "Try a different name or mobile number."
          : "Add your first student using the form above."}
      </p>

      {searching && (
        <button
          type="button"
          onClick={onClearSearch}
          className="
            mt-4
            rounded-lg
            border
            border-stone-300
            bg-white
            px-4
            py-2
            text-xs
            font-medium
            text-stone-600
            transition
            hover:bg-stone-50
          "
        >
          Clear Search
        </button>
      )}
    </section>
  );
}

/* =========================================================
   SKELETON
========================================================= */

function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded bg-stone-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-stone-200" />
      </div>

      <div className="h-32 animate-pulse rounded-xl border border-stone-200 bg-white" />

      <div className="h-16 animate-pulse rounded-xl border border-stone-200 bg-white" />

      <div className="h-[420px] animate-pulse rounded-xl border border-stone-200 bg-white" />
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function getSeatLabel(student: Student) {
  if (student.seatDetails) {
    const labName = student.seatDetails.lab?.name;

    const seatNumber = student.seatDetails.seatNumber;

    if (labName && seatNumber !== undefined) {
      return `${labName} · Seat ${seatNumber}`;
    }

    if (seatNumber !== undefined) {
      return `Seat ${seatNumber}`;
    }
  }

  return student.seat ?? "Assigned";
}

function formatCurrency(amount?: number) {
  return `₹${Number(amount ?? 0).toLocaleString("en-IN")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* =========================================================
   ICONS
========================================================= */

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="
        pointer-events-none
        absolute
        left-3
        top-1/2
        h-4
        w-4
        -translate-y-1/2
        text-stone-400
      "
    >
      <circle
        cx="8.5"
        cy="8.5"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M13 13l4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
      <path
        d="M12 5l-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
      <path
        d="M8 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SeatIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
      <rect
        x="4"
        y="3"
        width="12"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M6 11v4M14 11v4M6 14h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StudentIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />

      <path
        d="M4.5 17c.5-3 2.3-4.5 5.5-4.5s5 1.5 5.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
